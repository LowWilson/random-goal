const $ = (id) => document.getElementById(id);

const defaults = {
  goal: 3,
  items: [{name:"A",count:0},{name:"B",count:0},{name:"C",count:0}],
  orderItems: [{name:"研究"},{name:"TOEIC"},{name:"筋トレ"}],
  orderResults: [],
  history: [],
  memo: "",
  rotation: 0
};

let state = { ...defaults, ...(JSON.parse(localStorage.getItem("randomGoalState") || "{}")) };
if (!state.orderItems) state.orderItems = state.items.map(x => ({ name: x.name }));
if (!state.orderResults) state.orderResults = [];
if (!state.history) state.history = [];
if (!state.memo) state.memo = "";

let spinning = false;
let autoRunning = false;
let finished = state.items.some(x => x.count >= state.goal);
let stopRequested = false;

function save(){ localStorage.setItem("randomGoalState", JSON.stringify(state)); }

function render(){
  $("goalValue").textContent = state.goal;
  renderWheel(); renderItems(); renderHistory(); renderOrderItems(); renderOrderResults();
  $("memoText").value = state.memo || "";
  if (finished) {
    $("spinBtn").textContent = "終了！Resetして再開";
    $("spinBtn").disabled = true;
  } else if (autoRunning) {
  $("spinBtn").textContent = "止める";
  $("spinBtn").disabled = false;
  } else {
  $("spinBtn").textContent = "自動で回す！";
  $("spinBtn").disabled = false;
  }

function renderWheel(){
  const wheel = $("wheel");
  wheel.querySelectorAll(".wheel-label").forEach(el => el.remove());
  wheel.style.transform = `rotate(${state.rotation}deg)`;
  const n = state.items.length || 1;
  state.items.forEach((item,i)=>{
    const angle=(360/n)*i;
    const label=document.createElement("div");
    label.className="wheel-label"; label.textContent=item.name;
    label.style.transform=`rotate(${angle}deg) translate(42px, -8px) rotate(90deg)`;
    wheel.appendChild(label);
  });
}

function renderItems(){
  const list=$("itemsList"); list.innerHTML="";
  state.items.forEach((item,i)=>{
    const row=document.createElement("div");
    row.className="item-card"+(item.count>=state.goal?" done":"");
    row.innerHTML=`<strong>${escapeHtml(item.name)}</strong><span class="count">${item.count}/${state.goal}</span><button class="delete" data-i="${i}">削除</button>`;
    list.appendChild(row);
  });
  document.querySelectorAll("#itemsList .delete").forEach(btn=>{
    btn.onclick=()=>{
      if(autoRunning) return;
      if(state.items.length<=2) return alert("項目は最低2つ必要。押し切りすぎ注意。");
      state.items.splice(Number(btn.dataset.i),1);
      finished = state.items.some(x => x.count >= state.goal);
      save(); render();
    };
  });
}

function renderHistory(){
  const box=$("historyList");
  if(!state.history.length){ box.innerHTML='<div class="empty">まだ履歴なし</div>'; return; }
  box.innerHTML=state.history.slice(0,7).map(x=>`<div class="history-pill">${escapeHtml(x)}</div>`).join("");
}

function renderOrderItems(){
  const list=$("orderItemsList"); list.innerHTML="";
  state.orderItems.forEach((item,i)=>{
    const row=document.createElement("div");
    row.className="item-card simple";
    row.innerHTML=`<strong>${escapeHtml(item.name)}</strong><button class="delete" data-i="${i}">削除</button>`;
    list.appendChild(row);
  });
  document.querySelectorAll("#orderItemsList .delete").forEach(btn=>{
    btn.onclick=()=>{
      // 入力項目だけ削除。結果リストには影響させない。
      state.orderItems.splice(Number(btn.dataset.i),1);
      save(); renderOrderItems();
    };
  });
}

function renderOrderResults(){
  const list=$("orderList");
  if(!state.orderResults.length){ list.innerHTML='<div class="empty">まだ結果なし</div>'; return; }
  list.innerHTML="";
  state.orderResults.forEach((name,i)=>{
    const row=document.createElement("div");
    row.className="item-card simple";
    row.innerHTML=`<strong><span class="order-rank">${i+1}</span>${escapeHtml(name)}</strong><button class="delete" data-i="${i}">削除</button>`;
    list.appendChild(row);
  });
  document.querySelectorAll("#orderList .delete").forEach(btn=>{
    btn.onclick=()=>{
      // 結果だけ削除。Order項目にもルーレットにも影響させない。
      state.orderResults.splice(Number(btn.dataset.i),1);
      save(); renderOrderResults();
    };
  });
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function autoSpin(){
  if(finished) return;

  if(autoRunning){
    stopRequested = true;
    $("spinBtn").textContent = "停止中...";
    return;
  }

  if(state.items.length<2) return alert("項目を2つ以上入れてね。ルーレットが虚無になる。");

  autoRunning = true;
  stopRequested = false;
  $("spinBtn").disabled = false;
  $("spinBtn").textContent = "止める";

  while(!finished && !stopRequested){
    await spinOnce();
    if(!finished && !stopRequested) await sleep(180);
  }

  autoRunning = false;

  if(!finished){
    $("spinBtn").textContent = "自動で回す！";
    $("spinBtn").disabled = false;
    $("resultText").textContent = "Stopped";
  }

  stopRequested = false;
}

function spinOnce(){
  return new Promise(resolve=>{
    if(spinning || finished) return resolve();
    spinning=true; $("resultText").textContent="Spinning...";
    const winner=Math.floor(Math.random()*state.items.length);
    const anglePerItem=360/state.items.length;
    const targetAngle=360-winner*anglePerItem-anglePerItem/2;
    const currentMod=((state.rotation%360)+360)%360;
    const delta=720+((targetAngle-currentMod+360)%360);
    state.rotation+=delta; renderWheel();
    setTimeout(()=>{
      state.items[winner].count+=1;
      const picked=state.items[winner];

      $("resultText").textContent=`${picked.name}！`;
      if(navigator.vibrate) navigator.vibrate(25);

      if(picked.count>=state.goal){
        finished=true;
        state.history.unshift(picked.name);
        state.history=state.history.slice(0,7);

        $("resultText").textContent=`GOAL! ${picked.name} が ${state.goal} 回達成`;
        $("spinBtn").textContent="終了！Resetして再開"; 
        $("spinBtn").disabled=true;
      }

      spinning=false; 
      save(); 
      renderItems(); 
      renderHistory(); 
      resolve();
    },1080);
  });
}

function shuffleOrder(){
  if(state.orderItems.length<2) return alert("Order項目を2つ以上入れてね。");
  const arr=[...state.orderItems.map(x=>x.name)];
  for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  state.orderResults = arr;
  save(); renderOrderResults();
}

function resetAll(){
  if(autoRunning) return;
  state.items=state.items.map(x=>({...x,count:0}));
  finished=false; $("resultText").textContent="Ready"; save(); render();
}
function addItem(){ const input=$("itemInput"); const name=input.value.trim(); if(!name) return; state.items.push({name,count:0}); input.value=""; finished=false; save(); render(); }
function addOrderItem(){ const input=$("orderInput"); const name=input.value.trim(); if(!name) return; state.orderItems.push({name}); input.value=""; save(); renderOrderItems(); }
function clearHistory(){ state.history=[]; save(); renderHistory(); }
function clearOrderResults(){ state.orderResults=[]; save(); renderOrderResults(); }
function escapeHtml(str){ return String(str).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

$("spinBtn").onclick=autoSpin; $("shuffleBtn").onclick=shuffleOrder; $("resetAllBtn").onclick=resetAll;
$("addItemBtn").onclick=addItem; $("addOrderBtn").onclick=addOrderItem; $("clearHistoryBtn").onclick=clearHistory; $("clearOrderResultsBtn").onclick=clearOrderResults;
$("itemInput").addEventListener("keydown",e=>{if(e.key==="Enter")addItem();});
$("orderInput").addEventListener("keydown",e=>{if(e.key==="Enter")addOrderItem();});
$("memoText").addEventListener("input",e=>{ state.memo=e.target.value; save(); $("memoStatus").textContent="Saved"; });
$("minusGoal").onclick=()=>{ if(state.goal>1 && !autoRunning){ state.goal--; finished=state.items.some(x=>x.count>=state.goal); save(); render(); } };
$("plusGoal").onclick=()=>{ if(!autoRunning){ state.goal++; finished=state.items.some(x=>x.count>=state.goal); save(); render(); } };
$("rouletteTab").onclick=()=>switchTab("roulette"); $("orderTab").onclick=()=>switchTab("order"); $("memoTab").onclick=()=>switchTab("memo");
function switchTab(mode){
  $("rouletteTab").classList.toggle("active",mode==="roulette"); $("orderTab").classList.toggle("active",mode==="order"); $("memoTab").classList.toggle("active",mode==="memo");
  $("rouletteMode").classList.toggle("active-panel",mode==="roulette"); $("orderMode").classList.toggle("active-panel",mode==="order"); $("memoMode").classList.toggle("active-panel",mode==="memo");
}
render();
