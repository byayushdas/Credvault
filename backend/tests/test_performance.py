import json,platform,time,statistics
from pathlib import Path
from sqlalchemy import text
from conftest import rule,request,auto_fetch
from app.database.database import engine

def test_runtime_audit_privileges():
    with engine.connect() as c:
        rights=c.execute(text("SELECT current_user, has_table_privilege(current_user,'cv_audit','INSERT'), has_table_privilege(current_user,'cv_audit','UPDATE'), has_table_privilege(current_user,'cv_audit','DELETE'), has_table_privilege(current_user,'cv_audit','TRUNCATE'), has_schema_privilege(current_user,'public','CREATE')")).one()
        assert rights[0]=='credvault_runtime' and rights[1] and not any(rights[2:]), rights

def test_local_processing_target(workflow):
    w=workflow;rule(w['owner'],w['doc'],w['orgs'][3],'degree','AUTO_APPROVE')
    auto_fetch(w['owner'],w['doc'])
    evaluations=[];retrievals=[]
    for _ in range(25):
        start=time.perf_counter();response=request(w['verifier'],w['doc'],['degree']);evaluations.append((time.perf_counter()-start)*1000)
        assert response.status_code==201 and response.json()['status']=='APPROVED'
        start=time.perf_counter();response=w['verifier'].get('/api/v1/verification/requests/'+response.json()['id']+'/result');retrievals.append((time.perf_counter()-start)*1000)
        assert response.status_code==200
    def stats(values):
        return {k:round(v,2) for k,v in {'median_ms':statistics.median(values),'p95_ms':sorted(values)[23],'max_ms':max(values)}.items()}
    with w['engine'].connect() as c:postgres=c.execute(text('SELECT version()')).scalar()
    result={'platform':platform.platform(),'python':platform.python_version(),'database':postgres,'transport':'FastAPI TestClient in-process, real loopback PostgreSQL; includes database/audit commits; excludes human waiting and large file transfer','samples':25,'dataset':{'users':5,'organizations':3,'credentials':6,'initial_requests':6,'added_requests':25,'requested_fields_per_request':1,'consent_rules':5},'automatic_evaluation':stats(evaluations),'result_retrieval':stats(retrievals)}
    folder=Path(__file__).resolve().parents[2]/'test-results';folder.mkdir(exist_ok=True)
    (folder/'performance.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    assert max(evaluations)<2000 and max(retrievals)<2000
    print(json.dumps(result,indent=2))
