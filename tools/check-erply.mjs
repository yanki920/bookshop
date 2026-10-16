import {configurationStatus,createErplyClient} from '../integrations/erply.mjs';
// Reports readiness only: never print credentials, sessions or shop records.
const status=configurationStatus();
if(!status.configured){console.error('Erply not connected. Missing secure settings: '+status.missing.join(', '));process.exitCode=1;}
else{try{await createErplyClient().authenticate();console.log('Erply authentication verified. No customer, product, stock or payment records were read or changed.');}catch(e){console.error(e.message);process.exitCode=1;}}
