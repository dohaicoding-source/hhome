import {database} from '@/lib/database';
import {currentUser} from '@/lib/identity';
import {apiError,json} from '@/lib/access';
export async function GET(req:Request){try{const user=await currentUser(req);if(!user)return json({user:null,memberships:[]});const {results}=await database().prepare('SELECT m.id,m.workspace_id,m.role,m.name,m.building_ids,m.tenant_id,w.name AS workspace_name FROM memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=? AND m.status=? ORDER BY m.created_at').bind(user.id,'active').all();return json({user,memberships:results});}catch(e){return apiError(e);}}
