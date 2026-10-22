import {createHostedApp} from '../../hosted/app.mjs';
const handle=createHostedApp();
export default async function(request){return handle(request);}
