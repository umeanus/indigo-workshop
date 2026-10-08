import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {canvasTestEnv} from './canvas-test-env.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const testEnv=await canvasTestEnv();
// Historical physics and v14/v15 localized-knot suites remain archived. Current
// cloth QA verifies the continuous mesh, separate binding and actual unfolding.
const suites=['objects-ritual-v17.test.cjs','tie-cloth-v16.test.cjs','workbench-v16.test.cjs','cloth-flow-v16.test.cjs','ritual-motion-v16.test.cjs','photo-tonal-v14.test.cjs','items-flow.test.cjs','recipes.test.cjs','recipe-gesture.test.cjs','material-stages.test.cjs','fibrous-resist.test.cjs','project.test.cjs','interactions.test.cjs','no-unfold-fan.test.cjs','gallery.test.cjs','intro-long-page.test.cjs'];
for(const file of suites){
 const result=spawnSync(process.execPath,['--expose-gc',path.join(root,'tests',file)],{cwd:root,stdio:'inherit',env:testEnv});
 if(result.status!==0)process.exit(result.status||1);
}
console.log(`All ${suites.length} active test suites passed. Browser layout and device checks remain separate.`);
