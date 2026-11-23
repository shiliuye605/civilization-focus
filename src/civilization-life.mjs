import { makeRegionalPlan } from './regional-lives.mjs';

const DAY = 132;
const BEATS = [5, 24, 46, 79, 106];
const SHIFT_BOUNDARIES = [39, 82, 112, DAY];
const TAU = Math.PI * 2;
const home = (x,z,face=0) => [x,z,face,'rest'];
const job = (x,z,face=0,task='work') => [x,z,face,task];

const plans = {
  stone:{
    ground:.023,
    lane:[[-1.12,.105],[-.55,.122],[-.09,.124],[.26,.128],[.433,.096],[.56,.083],[.79,.067]],
    sites:{
      shelter:home(-.765,.047,.88), nook:home(.132,-.015,2.0), shade:home(-.888,.025,-.45),
      grove:job(-.887,.061,2.2,'gather'), berries:job(.667,.038,2.5,'gather'),
      workbench:job(-.251,.123,-.66), rack:job(-.082,-.051,2.55), ford:job(.468,.075,.50,'gather'),
      hearth:job(-.425,.101,-2.7,'gather'), talk:job(-.538,.090,2.3,'talk'), meeting:job(.193,.056,-.72,'talk'),
    },
    people:{
      StoneGatherer:['shelter',['grove','berries'],'rack','talk','ford'],
      StoneToolmaker:['shade','workbench','hearth','talk',['rack','workbench']],
      StoneKeeper:['shelter','hearth','grove','meeting','rack'],
      StoneFordWalker:['nook',['ford','berries'],'rack','meeting','hearth'],
      StoneCarrier:['nook','rack',['grove','ford'],'talk','workbench'],
    },
  },
  tang:{
    ground:.026,
    lane:[[-1.12,.151],[-.55,.145],[-.19,.126],[.02,.081],[.17,.093],[.45,.060],[.78,.061]],
    sites:{
      west:home(-.871,.137,1.05), gate:home(-.503,.077,2.9), east:home(.152,.081,1.72),
      field:job(.314,.060,2.93,'gather'), northField:job(.565,.056,2.5,'gather'),
      mill:job(-.086,.091,-2.4), millBank:job(.018,.097,2.9),
      baskets:job(-.622,.117,3.02), hall:job(-.682,.101,2.9,'talk'),
      shade:job(-.936,.160,-.56,'talk'), bridge:job(.046,.076,1.1,'talk'),
    },
    people:{
      TangHarvester:['east',['field','northField'],'baskets','shade','millBank'],
      TangFarmer:['gate',['northField','field'],'millBank','bridge','baskets'],
      TangMillWorker:['east','mill','baskets','hall','millBank'],
      TangVillager:['west','hall','field','shade','baskets'],
      TangCarrier:['gate','baskets',['field','northField'],'bridge','hall'],
    },
  },
  steam:{
    ground:.025,
    lane:[[-1.10,.057],[-.78,.064],[-.45,.070],[-.10,.086],[.23,.081],[.46,.070],[.78,.059]],
    sites:{
      west:home(-.893,.043,-.18), station:home(.259,.072,-1.86), east:home(.691,.045,-.25),
      workshop:job(-.406,.062,-1.5), inspection:job(-.222,.040,-2.7),
      cargo:job(.097,.065,2.3,'gather'), gauges:job(.583,.026,3.0),
      platform:job(.321,.074,-.15,'talk'), crossing:job(.433,.064,1.2,'talk'), garden:job(-.879,.070,-.55,'talk'),
    },
    people:{
      SteamEngineer:['west','workshop',['inspection','gauges'],'garden','platform'],
      SteamLoader:['station',['cargo','inspection'],'workshop','platform','cargo'],
      SteamTraveler:['east','platform','cargo','crossing','garden'],
      SteamWorker:['west','workshop','cargo','garden','inspection'],
      SteamWatch:['east','gauges','inspection','crossing','platform'],
    },
  },
  information:{
    ground:.031,
    lane:[[-1.09,.073],[-.800,.064],[-.535,.085],[-.288,.079],[-.091,.091],[.11,.091],[.424,.080],[.77,.067]],
    sites:{
      west:home(-.948,.105,1.7), south:home(-.422,.082,.2), east:home(.570,.079,-.5),
      tower:job(-.744,-.010,-2.84), studio:job(-.474,-.001,-2.65), network:job(.116,.070,-2.84),
      gallery:job(.451,.038,2.1), fibre:job(-.172,.101,-2.0),
      gardens:job(-.581,.117,-.33,'talk'), plaza:job(-.292,.120,1.58,'talk'),
      pool:job(.338,.114,1.50,'talk'), transit:job(.613,.073,-.94,'talk'),
    },
    people:{
      Info_Commuter:['west',['tower','studio'],'network','plaza','transit'],
      Info_Pedestrian:['west',['studio','tower'],'gallery','gardens','plaza'],
      Info_PlazaVisitor:['south','fibre',['gallery','studio'],'pool','plaza'],
      Info_Engineer:['south','network',['tower','fibre'],'gardens','transit'],
      Info_Traveler:['east','transit',['network','gallery'],'pool','tower'],
      Info_Friend:['east','gallery','fibre','plaza','gardens'],
    },
  },
};

function hash32(n) {
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function interpolateAt(lane,x) {
  let i=1;
  while(i<lane.length-1 && lane[i][0]<x)i++;
  const [ax,az]=lane[i-1], [bx,bz]=lane[i];
  const p=(x-ax)/(bx-ax);
  return az+(bz-az)*p;
}
const smooth=t=>t*t*(3-2*t);
const between=(a,b,t)=>a+(b-a)*t;
function angleBetween(a,b,t){
  const d=Math.atan2(Math.sin(b-a),Math.cos(b-a));
  return a+d*t;
}

function makeRoute(lane,from,to,offset) {
  const side=Math.sign(to[0]-from[0]);
  const first=[from[0],interpolateAt(lane,from[0])+offset];
  const last=[to[0],interpolateAt(lane,to[0])+offset];
  let middle=lane.filter(p=>side*(p[0]-from[0])>.001&&side*(to[0]-p[0])>.001).map(([x,z])=>[x,z+offset]);
  if(side<0)middle.reverse();
  const points=[from,first,...middle,last,to];
  const pieces=[];
  let length=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(len<=.001)continue;
    pieces.push({a,b,len,start:length,angle:Math.atan2(b[0]-a[0],b[1]-a[1])});
    length+=len;
  }
  return {pieces,length};
}
function sampleRoute(route,distance){
  let i=0;
  while(i<route.pieces.length-1 && route.pieces[i].start+route.pieces[i].len<distance)i++;
  const s=route.pieces[i];
  const u=Math.min(1,Math.max(0,(distance-s.start)/s.len));
  let heading=s.angle;
  if(i>0 && u<.22)heading=angleBetween(route.pieces[i-1].angle,s.angle,smooth(u/.22));
  return [between(s.a[0],s.b[0],u),between(s.a[1],s.b[1],u),heading];
}

function spot(point,index) {
  // Give each character a small lane and destination offset if paths coincide.
  return [point[0]+((index%3)-1)*.014,point[1]+(index%2?-.009:.008),point[2],point[3]];
}
function buildDay(plan, itinerary, index, day) {
  const choice=(entry,step)=>{
    if(typeof entry==='string')return entry;
    return entry[Math.floor(hash32((day+11)*9091+index*71+step*137)*entry.length)];
  };
  const homeSite=spot(plan.sites[itinerary[0]],index);
  const roles=[...itinerary.slice(1),itinerary[0]];
  const offsets=BEATS.map((beat,i)=>beat + (index%3)*2.5 + (hash32((day+8)*953+index*67+i*619)-.5)*2.8);
  const schedule=[];
  let current=homeSite, cursor=0;
  for(let i=0;i<roles.length;i++){
    const next=spot(plan.sites[choice(roles[i],i)],index);
    const route=makeRoute(plan.lane,current,next,(index%2?-.010:.010));
    const departure=Math.max(cursor,offsets[i]);
    if(departure>cursor)schedule.push({start:cursor,end:departure,spot:current});
    const speed=(.083 + index*.003);
    const travel=Math.min(24,route.length/speed,DAY-1-departure);
    if(travel>.10)schedule.push({start:departure,end:departure+travel,from:current,to:next,route});
    cursor=departure+travel;
    current=next;
  }
  schedule.push({start:cursor,end:DAY,spot:homeSite});
  return schedule;
}

function pose(actor,activity,t,gait) {
  const p=t*(1.9 + actor.index*.11)+actor.index*.72;
  const blink=activity==='walk'?Math.sin(gait):0;
  const work=activity==='work'||activity==='gather';
  const crouch=activity==='gather';
  const nod=activity==='talk';
  const breath=Math.sin(p*.58);
  actor.upper.position.y=.049+(activity==='walk'?Math.abs(blink)*.0022:breath*.00075);
  actor.upper.rotation.x=crouch?.33:work?.12:nod?.045*Math.sin(p):activity==='walk'?.05:.015*breath;
  actor.upper.rotation.y=nod?Math.sin(p*.39)*.12:0;
  actor.arms[0].rotation.x=activity==='walk'?-blink*.41:work?-.33+(crouch?.16:.07)*Math.sin(p):nod?-.12+.13*Math.sin(p):-.050;
  actor.arms[1].rotation.x=activity==='walk'?blink*.41:work?-.47+.29*Math.sin(p):nod?-.10+.26*Math.sin(p*.69):-.062;
  actor.legs[0].rotation.x=blink*.46;
  actor.legs[1].rotation.x=-blink*.46;
  const head=actor.head;
  if(head){
    head.rotation.y=work?.08*Math.sin(p*.44):nod?.20*Math.sin(p*.62):.13*Math.sin(p*.25);
    head.rotation.x=crouch?.16:work?.11:nod?.07*Math.sin(p):0;
  }
}

export function createCivilizationLife(scene,era) {
  const plan=plans[era]??makeRegionalPlan(era);
  if(!plan) return {seek() {}, activity(){return [];}};
  const actors=Object.entries(plan.people).map(([name,itinerary], index)=>{
    const n = suffix=>scene.getObjectByName(name+suffix);
    return {name,itinerary,index,figure:n(''),body:n('_Heading'),upper:n('_Upper'),head:n('_Head'),
      arms:[n('_Arm0'),n('_Arm1')],legs:[n('_Leg0'),n('_Leg1')],schedule:[],day:-1,action:''};
  }).filter(a=>a.figure&&a.body&&a.upper&&[...a.arms,...a.legs].every(Boolean));
  return {
    seek(seconds) {
      const t=Math.max(0,seconds);
      const day=Math.floor(t/DAY),second=t-day*DAY;
      for(const a of actors){
        if(a.day!==day){
          a.schedule=buildDay(plan,a.itinerary,a.index,day);
          a.day=day;
        }
        const item=a.schedule.find(piece=>second>=piece.start&&second<piece.end)??a.schedule.at(-1);
        let x,z,heading;
        let gait=0;
        if(item.route){
          const progress=(second-item.start)/(item.end-item.start);
          const distance=item.route.length*progress;
          [x,z,heading]=sampleRoute(item.route,distance);
          if(progress<.09)heading=angleBetween(item.from[2],heading,smooth(progress/.09));
          if(progress>.92)heading=angleBetween(heading,item.to[2],smooth((progress-.92)/.08));
          gait=distance/.056*TAU;
          a.action='walk';
        }else{
          [x,z,heading,a.action]=item.spot;
        }
        a.figure.position.set(x,plan.ground,z);
        a.body.rotation.y=heading;
        pose(a,a.action,t,gait);
      }
    },
    activity(){
      return actors.map(a=>({name:a.name,action:a.action,x:a.figure.position.x,z:a.figure.position.z}));
    },
  };
}

export function nextLifePhase(seconds) {
  const day=Math.floor(seconds/DAY)*DAY,phase=seconds-day;
  return day+(SHIFT_BOUNDARIES.find(s=>s>phase+.005)??DAY)+.015;
}
