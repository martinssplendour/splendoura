# backend/app/crud/__init__.py
from .crud_user import user
from .crud_group import group # Now 'crud.group' will work in your endpoints
from .crud_membership import membership
