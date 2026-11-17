const { chromium } = require('playwright');
const assert=require('node:assert/strict');
const output=require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(),'kai-check-')).replaceAll('\\','/');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8000/character.html');
    await page.waitForFunction(()=>window.__character?.expressions.supported);
    await page.screenshot({path:output+'/kai-detail-full.png'});
    await page.getByRole('button',{name:'얼굴 확대'}).click();
    await page.evaluate(()=>__character.expressionOverride=0);await page.waitForTimeout(200);
    await page.screenshot({path:output+'/kai-detail-face.png'});
    const morphs=await page.evaluate(()=>{let m;__character.model.traverse(o=>{if(o.morphTargetDictionary)m=o});return Object.keys(m.morphTargetDictionary)});
    assert.deepEqual(morphs,['Blink','LookLeft','LookRight']);
    await page.evaluate(()=>__character.expressionOverride=1);await page.waitForTimeout(160);
    await page.screenshot({path:output+'/kai-detail-blink.png'});
    assert(await page.evaluate(()=>{let ok=true;__character.model.traverse(o=>{if(o.morphTargetDictionary)ok&&=o.morphTargetInfluences[o.morphTargetDictionary.Blink]===1});return ok}));
    await page.evaluate(()=>__character.expressionOverride=null);
    await page.getByRole('button',{name:'전체 보기'}).click();await page.getByRole('button',{name:'달리기',exact:true}).click();await page.waitForTimeout(400);
    await page.screenshot({path:output+'/kai-detail-run.png'});
    const floor=await page.evaluate(async()=>{
      const THREE=await import('/vendor/three.module.min.js');const c=__character;
      c.mixer.stopAllAction();c.actions.Run.reset().play();
      let min=Infinity,max=-Infinity;const v=new THREE.Vector3();
      for(let i=0;i<24;i++){
        c.mixer.setTime(c.actions.Run.getClip().duration*i/24);c.model.updateMatrixWorld(true);
        c.model.traverse(m=>{if(!m.isSkinnedMesh||m.material.name!=='Undersuit charcoal')return;m.skeleton.update();
          const p=m.geometry.attributes.position;
          for(let j=0;j<p.count;j++){if(p.getY(j)>.2)continue;v.fromBufferAttribute(p,j);m.applyBoneTransform(j,v);min=Math.min(min,v.y);max=Math.max(max,v.y)}
        });
      }
      return {min,max};
    });assert(Number.isFinite(floor.min)&&floor.min>-.06,JSON.stringify(floor));
    await page.getByRole('button',{name:'직전 버전',exact:true}).click();await page.waitForFunction(()=>__character.type==='previous');assert.equal(await page.evaluate(()=>__character.expressions.supported),false);
    await page.goto('http://127.0.0.1:8000/');await page.locator('#btn-start').click();await page.locator('#btn-play').click();
    await page.waitForFunction(()=>{let yes=false;__game.renderer.scene.traverse(o=>{if(o.userData.expressions)yes=true});return yes});
    const game=await page.evaluate(async()=>{
      const {HEROES}=await import('/js/data.js');const {buildHero}=await import('/js/models.js');const {createExpressions}=await import('/js/character-style.js');
      const a=buildHero(HEROES.kai,0),b=buildHero(HEROES.kai,1);__game.renderer.scene.add(a.root,b.root);await new Promise(r=>setTimeout(r,400));
      const skins=o=>{let s;o.traverse(m=>{if(m.isSkinnedMesh)s=m});return s};const sa=skins(a.root),sb=skins(b.root);
      const independent=sa.skeleton.bones[0]!==sb.skeleton.bones[0]&&sa.morphTargetInfluences!==sb.morphTargetInfluences;
      createExpressions(a.root).update(0,0,1);createExpressions(b.root).update(0,0,0);
      const facialIndependent=sa.morphTargetInfluences[sa.morphTargetDictionary.Blink]===1&&sb.morphTargetInfluences[sb.morphTargetDictionary.Blink]===0;
      const h={...__game.player,x:800,y:1000,vx:0,vy:0,face:0,alive:true,buffs:[],dash:null,recall:null,invulnT:0,flashT:0,stunT:0,castSlot:null,castT:-10};
      a.update(h,.1,2);const idle=a.root.userData.animationState;h.vx=335;a.update(h,.1,2.1);const run=a.root.userData.animationState;h.castSlot='lmb';h.castT=2.1;a.update(h,.1,2.15);const slash=a.root.userData.animationState;
      a.root.removeFromParent();b.root.removeFromParent();__game.player.x=850;__game.player.y=1050;__game.renderer.view.yaw=.8;
      return {independent,facialIndependent,idle,run,slash};
    });assert(game.independent&&game.facialIndependent);assert.deepEqual([game.idle,game.run,game.slash],['Idle','Run','Slash']);
    await page.waitForTimeout(400);await page.screenshot({path:output+'/kai-detail-ingame.png'});
    assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify({morphs,floor,game,errors,output}));
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
