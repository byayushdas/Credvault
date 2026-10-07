import secrets
from authlib.oauth2.rfc6749 import AuthorizationServer, OAuth2Request
from authlib.oauth2.rfc6749.requests import BasicOAuth2Payload
from authlib.oauth2.rfc6749.grants import ClientCredentialsGrant
from authlib.oauth2.rfc6749.errors import InvalidScopeError, OAuth2Error
from fastapi.responses import JSONResponse
from ..models import OAuthClient, OAuthToken, Organization, User
from ..core.security import digest, verify_password, future
from ..core.config import settings

SCOPES = ['requests:read', 'requests:write', 'results:read']

class Client:
    def __init__(self, record):
        self.record = record
    def get_client_id(self):
        return self.record.id
    def check_client_secret(self, value):
        return verify_password(value, self.record.secret_hash)
    def check_endpoint_auth_method(self, method, endpoint):
        return method == 'client_secret_basic'
    def check_grant_type(self, grant_type):
        return grant_type == 'client_credentials'
    def get_allowed_scope(self, scope):
        requested = set((scope or self.record.scopes).split())
        if not requested <= set(self.record.scopes.split()):
            raise InvalidScopeError()
        return ' '.join(sorted(requested))

class Server(AuthorizationServer):
    def __init__(self, db):
        super().__init__(SCOPES)
        self.db = db
        self.register_grant(ClientCredentialsGrant)
        self.register_token_generator('client_credentials', self.token)
    def query_client(self, client_id):
        c = self.db.get(OAuthClient, client_id)
        org = self.db.get(Organization, c.organization_id) if c else None
        user = self.db.get(User, c.user_id) if c else None
        return Client(c) if c and not c.revoked and org and org.approved and user and user.active else None
    def token(self, grant_type, client, user=None, scope=None, **kwargs):
        return {'token_type': 'Bearer', 'access_token': secrets.token_urlsafe(48),
            'expires_in': 600, 'scope': client.get_allowed_scope(scope)}
    def save_token(self, token, request):
        self.db.add(OAuthToken(token_hash=digest(token['access_token']), client_id=request.client.record.id,
            scopes=token['scope'], expires_at=future(seconds=600)))
        self.db.flush()
    def create_oauth2_request(self, request):
        return request
    def send_signal(self, name, *args, **kwargs):
        # Framework integration hook; authorization uses persisted client/token records.
        return None
    def handle_response(self, status_code, payload, headers):
        self.db.commit()
        return JSONResponse(payload, status_code=status_code, headers=dict(headers))

def token_response(db, method, url, headers, data):
    try:
        req = OAuth2Request(method, url, headers=headers)
        req.payload = BasicOAuth2Payload(data)
        return Server(db).create_token_response(req)
    except OAuth2Error as exc:
        return JSONResponse({'error':exc.error, 'error_description':exc.description}, status_code=400)
