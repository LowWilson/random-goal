const colors=["#36e7ff","#4dff9a","#7c5cff","#ffce45","#ff477e","#00b7ff","#22ffaa","#b967ff","#00ffd5"];
const $=id=>document.getElementById(id);
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
let currentUser=null,firms=[],payouts=[],showAllHistory=false;
let filters={firmId:"all",year:"all",month:"all"};

function usd(n){return "$"+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}
function today(){return new Date().toISOString().slice(0,10);}
function escapeHtml(str){return String(str).replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[s]));}
function payoutYear(p){return (p.payout_date||"").slice(0,4);}
function payoutMonth(p){return (p.payout_date||"").slice(5,7);}
function payoutYearMonth(p){return (p.payout_date||"").slice(0,7);}
function totalAmount(list){return list.reduce((s,p)=>s+Number(p.amount),0);}
function getFilteredPayouts(){
  return payouts.filter(p=>{
    const firmOK=filters.firmId==="all"||p.firm_id===filters.firmId;
    const yearOK=filters.year==="all"||payoutYear(p)===filters.year;
    const monthOK=filters.month==="all"||payoutMonth(p)===filters.month;
    return firmOK&&yearOK&&monthOK;
  });
}

async function init(){
  $("dateInput").value=today();
  const {data}=await sb.auth.getSession();
  currentUser=data.session?.user||null;
  updateAuthView();
  if(currentUser) await loadData();
  sb.auth.onAuthStateChange(async(_event,session)=>{
    currentUser=session?.user||null;
    updateAuthView();
    if(currentUser) await loadData();
  });
}

function updateAuthView(){
  const loggedIn=!!currentUser;
  $("loginView").classList.toggle("hidden",loggedIn);
  $("appView").classList.toggle("hidden",!loggedIn);
  $("signOutBtn").classList.toggle("hidden",!loggedIn);
}

async function signIn(){
  await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin+window.location.pathname}});
}
async function signOut(){await sb.auth.signOut();}

async function loadData(){
  const {data:firmData,error:firmErr}=await sb.from("prop_firms").select("*").order("created_at",{ascending:true});
  if(firmErr){alert("firm読み込みエラー: "+firmErr.message);return;}
  const {data:payoutData,error:payoutErr}=await sb.from("payouts").select("*").order("created_at",{ascending:false});
  if(payoutErr){alert("payout読み込みエラー: "+payoutErr.message);return;}
  firms=firmData||[];
  payouts=payoutData||[];
  render();
}

function firmTotals(firmId){
  const list=payouts.filter(p=>p.firm_id===firmId);
  return {count:list.length,amount:totalAmount(list)};
}

function renderFilters(){
  const firmSelect=$("filterFirmSelect"),yearSelect=$("filterYearSelect"),monthSelect=$("filterMonthSelect");
  firmSelect.innerHTML='<option value="all">All Firms</option>';
  firms.forEach(f=>{const opt=document.createElement("option");opt.value=f.id;opt.textContent=f.name;firmSelect.appendChild(opt);});
  firmSelect.value=filters.firmId;
  const years=[...new Set(payouts.map(payoutYear).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
  yearSelect.innerHTML='<option value="all">All Years</option>';
  years.forEach(y=>{const opt=document.createElement("option");opt.value=y;opt.textContent=y;yearSelect.appendChild(opt);});
  if(!years.includes(filters.year)&&filters.year!=="all") filters.year="all";
  yearSelect.value=filters.year;
  monthSelect.innerHTML='<option value="all">All Months</option>';
  for(let i=1;i<=12;i++){const mm=String(i).padStart(2,"0");const opt=document.createElement("option");opt.value=mm;opt.textContent=mm;monthSelect.appendChild(opt);}
  monthSelect.value=filters.month;
}

function renderAnalytics(){
  const filtered=getFilteredPayouts(),amount=totalAmount(filtered);
  $("filteredAmount").textContent=usd(amount);
  $("filteredCount").textContent=filtered.length;
  const firmName=filters.firmId==="all"?"All firms":(firms.find(f=>f.id===filters.firmId)?.name||"Selected firm");
  const yearText=filters.year==="all"?"All years":filters.year;
  const monthText=filters.month==="all"?"All months":filters.month;
  $("analyticsLabel").textContent=`${firmName} / ${yearText} / ${monthText}`;
  renderYearly(filtered);
  renderMonthly(filtered);
}

function renderYearly(list){
  const map=new Map();
  list.forEach(p=>{const y=payoutYear(p)||"Unknown";if(!map.has(y))map.set(y,[]);map.get(y).push(p);});
  const rows=[...map.entries()].sort((a,b)=>b[0].localeCompare(a[0]));
  $("yearlyList").innerHTML=rows.length?"":'<div class="empty">年別データなし</div>';
  rows.forEach(([year,arr])=>{
    const div=document.createElement("div");div.className="summary-item";
    div.innerHTML=`<div><div class="summary-title">${year}</div><div class="summary-sub">${arr.length} payouts</div></div><div class="summary-amount">${usd(totalAmount(arr))}</div>`;
    $("yearlyList").appendChild(div);
  });
}

function renderMonthly(list){
  const map=new Map();
  list.forEach(p=>{const ym=payoutYearMonth(p)||"Unknown";if(!map.has(ym))map.set(ym,[]);map.get(ym).push(p);});
  const rows=[...map.entries()].sort((a,b)=>b[0].localeCompare(a[0]));
  $("monthlyList").innerHTML=rows.length?"":'<div class="empty">月別データなし</div>';
  rows.forEach(([ym,arr])=>{
    const div=document.createElement("div");div.className="summary-item";
    div.innerHTML=`<div><div class="summary-title">${ym}</div><div class="summary-sub">${arr.length} payouts</div></div><div class="summary-amount">${usd(totalAmount(arr))}</div>`;
    $("monthlyList").appendChild(div);
  });
}

function render(){
  const totalCount=payouts.length,allAmount=totalAmount(payouts);
  $("totalAmount").textContent=usd(allAmount);
  $("totalCount").textContent=totalCount;
  $("firmCount").textContent=firms.length;
  $("avgAmount").textContent=usd(totalCount?allAmount/totalCount:0);
  $("statusText").textContent=`${firms.length} firms / ${totalCount} payouts`;
  renderFilters();renderAnalytics();

  $("firmSelect").innerHTML="";
  firms.forEach(f=>{const opt=document.createElement("option");opt.value=f.id;opt.textContent=f.name;$("firmSelect").appendChild(opt);});

  $("firmList").innerHTML=firms.length?"":'<div class="empty">Prop firmを追加してね</div>';
  firms.forEach((firm,index)=>{
    const t=firmTotals(firm.id);
    const card=document.createElement("div");card.className="firm-card";
    card.style.setProperty("--firm-color",firm.color||colors[index%colors.length]);
    card.innerHTML=`<div class="firm-top"><div class="firm-name">${escapeHtml(firm.name)}</div><button class="ghost danger tiny-btn" data-delete-firm="${firm.id}">Delete</button></div><div class="firm-stats"><div class="stat"><strong>${t.count}</strong><span>Payout Times</span></div><div class="stat"><strong>${usd(t.amount)}</strong><span>Total USD</span></div></div>`;
    $("firmList").appendChild(card);
  });

  $("seeAllBtn").textContent=showAllHistory?"Show Less":"See All";
  const filteredForHistory=getFilteredPayouts();
  const displayPayouts=showAllHistory?filteredForHistory:filteredForHistory.slice(0,20);
  $("historyList").innerHTML=displayPayouts.length?"":'<div class="empty">まだpayout履歴なし</div>';
  displayPayouts.forEach(p=>{
    const firm=firms.find(f=>f.id===p.firm_id);
    const div=document.createElement("div");div.className="history-item";
    div.innerHTML=`<div><div class="history-main">${escapeHtml(firm?.name||p.firm_name||"Deleted Firm")}</div><div class="history-sub">${p.payout_date||""}${p.memo?" ・ "+escapeHtml(p.memo):""}</div></div><div><div class="amount">${usd(p.amount)}</div><button class="ghost danger tiny-btn" data-delete-payout="${p.id}">Delete</button></div>`;
    $("historyList").appendChild(div);
  });
}

async function addFirm(){
  const name=$("firmNameInput").value.trim();
  if(!name||!currentUser)return;
  const color=colors[firms.length%colors.length];
  const {error}=await sb.from("prop_firms").insert({name,color,user_id:currentUser.id});
  if(error){alert(error.message);return;}
  $("firmNameInput").value="";await loadData();
}

async function addPayout(){
  const firmId=$("firmSelect").value,firm=firms.find(f=>f.id===firmId),amount=Number($("amountInput").value);
  if(!firm||!amount||amount<=0||!currentUser)return;
  const {error}=await sb.from("payouts").insert({user_id:currentUser.id,firm_id:firmId,firm_name:firm.name,amount,payout_date:$("dateInput").value||today(),memo:$("memoInput").value.trim()});
  if(error){alert(error.message);return;}
  $("amountInput").value="";$("memoInput").value="";$("dateInput").value=today();await loadData();
}

async function deleteFirm(id){
  if(!confirm("このProp firmを消す？関連payoutも消えるよ。"))return;
  let {error}=await sb.from("payouts").delete().eq("firm_id",id);
  if(error){alert(error.message);return;}
  ({error}=await sb.from("prop_firms").delete().eq("id",id));
  if(error){alert(error.message);return;}
  await loadData();
}

async function deletePayout(id){
  const {error}=await sb.from("payouts").delete().eq("id",id);
  if(error){alert(error.message);return;}
  await loadData();
}

async function clearHistory(){
  if(!confirm("現在ログイン中の全payout履歴を消す？"))return;
  const {error}=await sb.from("payouts").delete().eq("user_id",currentUser.id);
  if(error){alert(error.message);return;}
  await loadData();
}

document.addEventListener("click",e=>{
  const firmId=e.target.dataset.deleteFirm,payoutId=e.target.dataset.deletePayout;
  if(firmId)deleteFirm(firmId);
  if(payoutId)deletePayout(payoutId);
});

$("googleLoginBtn").addEventListener("click",signIn);
$("signOutBtn").addEventListener("click",signOut);
$("addFirmBtn").addEventListener("click",addFirm);
$("addPayoutBtn").addEventListener("click",addPayout);
$("clearHistoryBtn").addEventListener("click",clearHistory);
$("firmNameInput").addEventListener("keydown",e=>{if(e.key==="Enter")addFirm();});
$("seeAllBtn").addEventListener("click",()=>{showAllHistory=!showAllHistory;render();});
$("filterFirmSelect").addEventListener("change",e=>{filters.firmId=e.target.value;showAllHistory=false;render();});
$("filterYearSelect").addEventListener("change",e=>{filters.year=e.target.value;showAllHistory=false;render();});
$("filterMonthSelect").addEventListener("change",e=>{filters.month=e.target.value;showAllHistory=false;render();});
init();
