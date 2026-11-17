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
    await page.waitForFunction(()=>window.__character?.type==='projected');
    const inspect=()=>page.evaluate(async()=>{
      const THREE=await import('/vendor/three.module.min.js');
      let colored=0,textured=0,meshes=0,faces=0;__character.model.traverse(o=>{if(o.isMesh){meshes++;if(o.geometry.attributes.color&&o.material.vertexColors)colored++;if(o.material.map)textured++;faces+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3}});
      const size=new THREE.Box3().setFromObject(__character.model).getSize(new THREE.Vector3());
      return {meshes,colored,textured,faces,height:size.y,clips:Object.keys(__character.actions),expressions:__character.expressions.supported};
    });
    const stats=await inspect();
    assert(stats.meshes>0&&stats.textured===stats.meshes&&stats.colored===0);assert(Math.abs(stats.height-2)<.03);
    assert.equal(stats.clips.length,0);assert.equal(stats.expressions,false);
    assert(await page.locator('[data-clip="Run"]').isDisabled());
    await page.locator('[data-model="sera"]').click();
    await page.waitForFunction(()=>window.__character?.type==='sera');
    const original=await inspect();
    assert.equal(original.colored,original.meshes);assert.equal(original.faces,stats.faces);
    await page.locator('[data-model="projected"]').click();
    await page.waitForFunction(()=>window.__character?.type==='projected');
    assert.equal(errors.length,0,errors.join('\n'));
    console.log(JSON.stringify({stats,original,errors}));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
