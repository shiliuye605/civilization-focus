import * as T from 'three';

const SEGMENTS=20;
const DURATION=1.28;
const SWITCH_BEAT=.50;
const colors={
  stone:['#706c4c','#d4b382'],
  tang:['#6b7352','#d4bc83'],
  steam:['#626d70','#c5b392'],
  information:['#425f69','#b7d2c8'],
};
function ease(n) {
  const t=T.MathUtils.clamp(n,0,1);
  return t*t*(3-2*t);
}

function leaf(group,start,end,index) {
  const geometry=new T.BufferGeometry();
  const count=(SEGMENTS+1)*2;
  const position=new T.BufferAttribute(new Float32Array(count*3),3).setUsage(T.DynamicDrawUsage);
  const paint=new T.BufferAttribute(new Float32Array(count*3),3);
  const indices=[];
  for(let j=0;j<SEGMENTS;j++){
    const a=j*2;
    indices.push(a,a+1,a+2,a+1,a+3,a+2);
  }
  geometry.setIndex(indices);
  geometry.setAttribute('position',position);
  geometry.setAttribute('color',paint);
  const material=new T.MeshStandardMaterial({name:'Curved terrain page',vertexColors:true,side:T.DoubleSide,roughness:.73,
    metalness:.17,transparent:true,depthWrite:false,opacity:0});
  const page=new T.Mesh(geometry,material);
  page.frustumCulled=false;
  page.renderOrder=12+index;
  group.add(page);
  const edgeGeo=new T.BufferGeometry();
  const edgeAttr=new T.BufferAttribute(new Float32Array(4*3),3);
  edgeGeo.setAttribute('position',edgeAttr);
  const edgeMat=new T.LineBasicMaterial({color:'#dbc099',transparent:true,depthWrite:false,opacity:0});
  const edge=new T.Line(edgeGeo,edgeMat);
  edge.renderOrder=19+index;
  edge.frustumCulled=false;
  group.add(edge);
  return {start,end,index,page,position,paint,geometry,material,edge,edgeAttr,edgeMat};
}

export function createEraTurn(mount) {
  const holder=new T.Group();
  holder.name='CivilizationPageTurn';
  holder.visible=false;
  mount.add(holder);
  const leaves=[
    leaf(holder,-1.15,-.47,0),
    leaf(holder,-.48,.19,1),
    leaf(holder,.18,.87,2),
  ];
  let time=0;
  let run=null;
  const tint=new T.Color();
  const fromBase=new T.Color();
  const toBase=new T.Color();

  function deform(sheet,progress) {
    const local=T.MathUtils.clamp((progress-sheet.index*.055)/.89,0,1);
    const open=ease(local/.27);
    const close=ease((1-local)/.24);
    const widthGain=(.26+.74*open)*(.64+.36*close);
    const alpha=.82*ease(local/.22)*ease((1-local)/.25);
    if(alpha<.004){
      sheet.page.visible=false;sheet.edge.visible=false;
      return;
    }
    sheet.page.visible=true;sheet.edge.visible=true;
    sheet.material.opacity=alpha;
    sheet.edgeMat.opacity=alpha*.74;
    const materialMix=ease((progress-.38)/.29);
    for(let j=0;j<=SEGMENTS;j++){
      const u=j/SEGMENTS;
      for(let k=0;k<2;k++){
        const x=k?sheet.end:sheet.start;
        const lengthFraction=(x+1.13)/2.02;
        const span=(.50-lengthFraction*.16)*widthGain;
        const bend=Math.sin(local*Math.PI);
        const angle=.08+ease(local)*2.93+u*.43*bend;
        const sag=(.003+u*.009)*Math.sin(bend*1.5);
        const y=.032 + Math.sin(angle)*span*u*.85 + sag;
        const z=.025 - Math.cos(angle)*span*u;
        const xx=x + (k?1:-1)*u*.003;
        const i=j*2+k;
        sheet.position.setXYZ(i,xx,y,z);
        const rib=(j%4===0?.045:0) + (j===0||j===SEGMENTS?.12:0);
        tint.copy(fromBase).lerp(toBase,materialMix).multiplyScalar(.83 + Math.sin(u*Math.PI)*.19 + rib);
        sheet.paint.setXYZ(i,tint.r,tint.g,tint.b);
        if(j===SEGMENTS)sheet.edgeAttr.setXYZ(k+1,xx,y+.0018,z);
        if(j===SEGMENTS-1){
          if(k===0)sheet.edgeAttr.setXYZ(0,xx-.0005,y+.0018,z);
          else sheet.edgeAttr.setXYZ(3,xx+.0005,y+.0018,z);
        }
      }
    }
    sheet.position.needsUpdate=true;
    sheet.paint.needsUpdate=true;
    sheet.edgeAttr.needsUpdate=true;
    sheet.geometry.computeVertexNormals();
  }

  function finish(){
    if(!run)return;
    const current=run;
    run=null;
    current.onDepth(0);
    holder.visible=false;
    current.onDone?.();
  }

  return {
    get active(){return Boolean(run);},
    start({from,to,onDepth,onSwap,onDone}) {
      if(run)return false;
      const a=colors[from]??colors.stone;
      const b=colors[to]??colors.information;
      fromBase.set(a[0]);toBase.set(b[0]);
      for(const page of leaves)page.edgeMat.color.set(b[1]);
      run={onDepth,onSwap,onDone,swapped:false};
      time=0;
      holder.visible=true;
      for(const page of leaves){page.page.visible=false;page.edge.visible=false;}
      return true;
    },
    update(dt) {
      if(!run)return false;
      time+=Math.max(0,dt);
      const t=T.MathUtils.clamp(time/DURATION,0,1);
      for(const page of leaves)deform(page,t);
      if(t>=SWITCH_BEAT&&!run.swapped){
        run.onDepth(1);
        run.swapped=true;
        run.onSwap?.();
      }
      // Hide both terrains at the same point, under the deck, before revealing the new one.
      const buried=t<SWITCH_BEAT ? ease(t/SWITCH_BEAT) : ease((1-t)/(1-SWITCH_BEAT));
      run.onDepth(buried);
      if(t===1)finish();
      return true;
    },
    complete(){
      if(!run)return;
      if(!run.swapped){
        run.swapped=true;
        run.onSwap?.();
      }
      finish();
    },
    dispose(){
      run=null;
      mount.remove(holder);
      for(const p of leaves){
        p.geometry.dispose();p.material.dispose();
        p.edge.geometry.dispose();p.edgeMat.dispose();
      }
    },
  };
}
