import type {Role} from './permissions';
export type AccountUser={id:string;name:string;phone:string};
export type Space={id:string;workspace_id:string;workspace_name:string;role:Role;name:string;building_ids:string;tenant_id:string|null};
