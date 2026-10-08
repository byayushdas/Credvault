import uuid
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app.core.config import settings
from app.database.database import Base, get_db, lock_transaction
from app.main import app, attempts
from app.models import Membership, now
from scripts.seed_demo import seed, EMAILS
PASSWORD='Test-only-password-2026!'
@pytest.fixture
def env(tmp_path):
    schema='cv_test_'+uuid.uuid4().hex
    database_url=settings.MIGRATION_DATABASE_URL or settings.DATABASE_URL
    admin=create_engine(database_url)
    assert admin.dialect.name=='postgresql', 'Integration tests require PostgreSQL'
    with admin.begin() as c:c.execute(text('CREATE SCHEMA '+schema))
    engine=create_engine(database_url,connect_args={'options':'-csearch_path='+schema})
    Base.metadata.create_all(engine)
    with engine.begin() as c:
        c.execute(text("CREATE FUNCTION cv_reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit records are append-only'; END; $$"))
        c.execute(text('CREATE TRIGGER cv_audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON cv_audit FOR EACH STATEMENT EXECUTE FUNCTION cv_reject_audit_mutation()'))
    factory=sessionmaker(engine,expire_on_commit=False)
    old_storage,old_mail=settings.STORAGE_PATH,settings.MAILBOX_PATH
    settings.STORAGE_PATH=str(tmp_path/'encrypted');settings.MAILBOX_PATH=str(tmp_path/'mailbox')
    attempts.clear()
    with factory() as db:
        lock_transaction(db);users=seed(db,PASSWORD);ids=[u.id for u in users]
        orgs=[db.get(Membership,i).organization_id for i in ids]
    def override():
        with factory() as db:
            lock_transaction(db)
            try:yield db;db.commit()
            except Exception:
                db.rollback()
                for undo in db.info.get('file_rollbacks',[]):undo()
                raise
    app.dependency_overrides[get_db]=override
    clients=[]
    def login(index=0):
        c=TestClient(app,base_url='http://localhost',raise_server_exceptions=False)
        response=c.post('/api/v1/auth/login',json={'email':EMAILS[index],'password':PASSWORD})
        assert response.status_code==200,response.text
        me=c.get('/api/v1/auth/me');assert me.status_code==200,me.text
        c.headers['X-CSRF-Token']=me.json()['csrf'];clients.append(c);return c
    yield {'factory':factory,'login':login,'ids':ids,'orgs':orgs,'app':app,'tmp':tmp_path,'engine':engine}
    for c in clients:c.close()
    app.dependency_overrides.clear();settings.STORAGE_PATH,settings.MAILBOX_PATH=old_storage,old_mail
    engine.dispose()
    assert schema.startswith('cv_test_') and len(schema)==40
    with admin.begin() as c:c.execute(text('DROP SCHEMA '+schema+' CASCADE'))
    admin.dispose()
@pytest.fixture
def workflow(env):
    issuer=env['login'](2);owner=env['login'](0);verifier=env['login'](3)
    response=issuer.post('/api/v1/issuer/documents',headers={'Idempotency-Key':str(uuid.uuid4())},json={
        'owner_id':env['ids'][0],'title':'Integration education','type':'DEGREE','issued_at':now(),
        'claims':{'degree':'PRIVATE-DEGREE-ALPHA','universityId':'PRIVATE-UNIVERSITY-A','cgpa':8.9,'rollNumber':'NEVER-SHARE-ROLL-9371'}})
    assert response.status_code==201,response.text
    return {**env,'issuer':issuer,'owner':owner,'verifier':verifier,'doc':response.json()}
def request(client,doc,fields=None,key=None,**overrides):
    data={'owner_id':doc['owner_id'],'credential_id':doc['id'],'fields':fields or ['degree','universityId','cgpa','rollNumber'],
        'purpose':'Verify education for fictional classroom exercise','lifetime_hours':24,**overrides}
    return client.post('/api/v1/verification/requests',json=data,headers={'Idempotency-Key':key or str(uuid.uuid4())})
def rule(client,doc,org,field,action,**overrides):
    return client.post('/api/v1/consent/rules',json={'credential_id':doc['id'],'verifier_id':org,'field':field,'action':action,**overrides})

def auto_fetch(client, doc, enabled=True):
    response = client.patch('/api/v1/documents/' + doc['id'] + '/auto-fetch', json={'auto_fetch': enabled})
    assert response.status_code == 200, response.text
    assert response.json()['auto_fetch'] is enabled
    return response.json()
