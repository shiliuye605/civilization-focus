export const ERAS={
  stone:{name:'石器时代',defaultId:'stone'},
  tang:{name:'农业时代',defaultId:'tang'},
  steam:{name:'工业时代',defaultId:'steam'},
  information:{name:'信息时代',defaultId:'information'},
};
const entries=[
  ['zhoukoudian','stone','周口店洞穴','亚洲 · 北京','洞口的石器工位、石灰岩和山溪。','https://whc.unesco.org/en/list/449/'],
  ['olduvai','stone','奥杜威峡谷','非洲 · 东非','赭色断层、开阔草地、金合欢树和采集小径。','https://whc.unesco.org/en/list/39/'],
  ['vezere','stone','韦泽尔河谷','欧洲 · 法国','石灰岩檐、林间火塘和带赭色图纹的洞壁。','https://whc.unesco.org/en/list/85/'],
  ['patagonia','stone','巴塔哥尼亚岩棚','美洲 · 阿根廷','平直的岩棚、峡谷河流与原创岩壁手印图纹。','https://whc.unesco.org/en/list/936/'],
  ['stone','stone','河谷聚落','时拓原创','兽皮营帐、篝火和溪流上的踏石。'],
  ['tang','tang','盛唐田园','亚洲 · 中国','瓦檐、金色田垄和灌溉水车。'],
  ['nile','tang','尼罗河渠村','非洲 · 埃及','泥砖屋、灌田水渠、棕榈和汲水装置。','https://www.britishmuseum.org/sites/default/files/2025-08/Life_in_ancient_Egypt_Visit_Resource.pdf'],
  ['andes','tang','安第斯梯田','美洲 · 秘鲁','沿山展开的石砌梯田、石阶与高地住屋。','https://americanindian.si.edu/inkaroad/engineering/video/preventing-erosion.html'],
  ['valencia','tang','瓦伦西亚渠田','欧洲 · 西班牙','橘树、白墙瓦屋、分水闸和田间路径。','https://ich.unesco.org/en/RL/water-tribunal-of-the-plain-of-valencia-00171'],
  ['steam','steam','蒸汽城镇','时拓原创','砖瓦厂房、站台和运煤列车。'],
  ['manchester','steam','曼彻斯特纺织镇','欧洲 · 英国','排窗棉纺厂、运河驳船和沿河搬运。','https://blog.scienceandindustrymuseum.org.uk/celebrating-salfords-centenary/'],
  ['ruhr','steam','鲁尔矿区','欧洲 · 德国','井架、输送廊、煤仓与货运路轨。','https://whc.unesco.org/en/list/975/'],
  ['yokohama','steam','横滨蒸汽港','亚洲 · 日本','码头吊机、红砖仓库、木栈桥和蒸汽船。','https://www.city.yokohama.lg.jp/lang/overseas/port/about_us/history/history.html'],
  ['lowell','steam','洛厄尔水力织造','美洲 · 美国','棉纺厂、分水渠和驱动机器的水轮。','https://www.nps.gov/articles/building-america-s-industrial-revolution-the-boott-cotton-mills-of-lowell-massachusetts-teaching-with-historic-places.htm'],
  ['kimberley','steam','金伯利露天矿','非洲 · 南非','分层矿坑、木制提升架、矿轨和分拣棚。','https://www.southafrica.net/gl/en/travel/article/the-kimberley-mine-museum-northern-cape-recapture-the-heady-days-of-the-diamond-rush'],
  ['information','information','时拓数字城','时拓原创','玻璃塔楼、数据中心与高架轻轨。'],
  ['helsinki','information','赫尔辛基智慧港','欧洲 · 芬兰','滨海街区、自行车道、渡船与港口传感设备。','https://www.hel.fi/en/urban-environment-and-traffic/urban-planning-and-construction/urban-development/jatkasaari'],
  ['nairobi','information','内罗毕创客街区','非洲 · 肯尼亚','太阳能雨棚、移动服务小店和开敞创客广场。','https://www.ict.go.ke/node/615'],
  ['silicon','information','硅谷研发园','美洲 · 美国','研究园区、草地中庭、实验室和微型配送车。','https://computerhistory.org/stories/silicon-valley/'],
  ['shenzhen','information','深圳华强北','亚洲 · 中国','电子市场、原型工坊、元件柜台与街巷配送。','https://www.sz.gov.cn/en_szgov/news/latest/content/post_12950959.html'],
];
export const SCENES=Object.fromEntries(entries.map(([id,era,label,region,description,source])=>[
  id,{id,era,label,region,description,source:source??null,file:id+'.glb',interpretive:id!==era},
]));
export const SCENE_ORDER=entries.map(e=>e[0]);
export const SCENES_BY_ERA=Object.fromEntries(Object.keys(ERAS).map(era=>[era,SCENE_ORDER.filter(id=>SCENES[id].era===era)]));
