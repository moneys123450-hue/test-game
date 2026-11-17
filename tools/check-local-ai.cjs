const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true,
    ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1200,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8000/sera-preview.html');
    await page.waitForFunction(()=>window.__character?.type==='rigged');
    const inspect=()=>page.evaluate(async()=>{
      const THREE=await import('/vendor/three.module.min.js');
      let colored=0,textured=0,meshes=0,faces=0;__character.model.traverse(o=>{if(o.isMesh){meshes++;if(o.geometry.attributes.color&&o.material.vertexColors)colored++;if(o.material.map)textured++;faces+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3}});
      const size=new THREE.Box3().setFromObject(__character.model).getSize(new THREE.Vector3());
      return {meshes,colored,textured,faces,height:size.y,clips:Object.keys(__character.actions),expressions:__character.expressions.supported};
    });
    const stats=await inspect();
    assert(stats.meshes>0&&stats.textured===stats.meshes&&stats.colored===0);assert(Math.abs(stats.height-2)<.03);
    assert.deepEqual(stats.clips,['Idle','Run','Slash']);assert.equal(stats.expressions,false);
    assert(!(await page.locator('[data-clip="Run"]').isDisabled()));
    await page.locator('#skeleton').click();
    assert(await page.evaluate(()=>__character.skeleton.visible&&__character.skeleton.bones.length===24));
    await page.locator('#pause-motion').click();
    const deformation=await page.evaluate(async()=>{
      const THREE=await import('/vendor/three.module.min.js');const c=__character;
      let skin;c.model.traverse(o=>{if(o.isSkinnedMesh)skin=o});
      const result={};
      for(const name of ['Idle','Run','Slash']){
        c.mixer.stopAllAction();c.actions[name].reset().play();
        const sample=t=>{c.mixer.setTime(t);c.model.updateMatrixWorld(true);skin.skeleton.update();const values=[];
          for(let i=0;i<skin.geometry.attributes.position.count;i+=100){const v=new THREE.Vector3().fromBufferAttribute(skin.geometry.attributes.position,i);skin.applyBoneTransform(i,v);values.push(v)}return values;};
        const a=sample(0),b=sample(name==='Idle'?1:.2);
        result[name]=Math.max(...a.map((p,i)=>p.distanceTo(b[i])));
      }
      return result;
    });
    for(const [name,delta] of Object.entries(deformation))assert(delta>.001&&delta<.9,`${name}: ${delta}`);
    for (const [i,button] of (await page.locator('[data-view]').all()).entries()) {
      await button.click();
      await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),`sera-multiview-browser-${i}.png`)});
    }
    await page.locator('[data-model="sera"]').click();
    await page.waitForFunction(()=>window.__character?.type==='sera');
    const original=await inspect();
    assert.equal(original.colored,original.meshes);assert.equal(original.faces,stats.faces);
    await page.locator('[data-model="projected"]').click();
    await page.waitForFunction(()=>window.__character?.type==='projected');
    const frontOnly=await inspect();assert.equal(frontOnly.textured,frontOnly.meshes);assert.equal(frontOnly.faces,stats.faces);
    await page.locator('[data-model="multiview"]').click();
    await page.waitForFunction(()=>window.__character?.type==='multiview');
    const staticFour=await inspect();assert.equal(staticFour.clips.length,0);assert.equal(staticFour.faces,stats.faces);
    assert(await page.locator('#skeleton').isDisabled());
    await page.locator('[data-model="rigged"]').click();
    await page.waitForFunction(()=>window.__character?.type==='rigged');
    assert.equal(errors.length,0,errors.join('\n'));
    console.log(JSON.stringify({stats,deformation,original,frontOnly,staticFour,errors}));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
