import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getDatabase, ref, set, get, update, runTransaction, increment } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyB_PymE3aacSLID0EZduTVTwXfqiC9-lts",
  authDomain: "iqzad-tap-eran-halal-crypto.firebaseapp.com",
  databaseURL: "https://iqzad-tap-eran-halal-crypto-default-rtdb.firebaseio.com/",
  projectId: "iqzad-tap-eran-halal-crypto",
  storageBucket: "iqzad-tap-eran-halal-crypto.firebasestorage.app",
  messagingSenderId: "94523079394",
  appId: "1:94523079394:web:5db9e23146eed248297cbb",
  measurementId: "G-RT0Y3Z9Y24"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();

// UI Elements
const loginBtn = document.getElementById('loginBtn');
const tapBtn = document.getElementById('tapBtn');
const pointsEl = document.getElementById('points');
const energyEl = document.getElementById('energy');
const energyText = document.getElementById('energyText');
const progressEl = document.getElementById('progress');
const refLinkInput = document.getElementById('refLink');
const copyRefBtn = document.getElementById('copyRef');
const refCountEl = document.getElementById('refCount');
const socialButtons = document.getElementById('socialButtons');
const formBtn = document.getElementById('formBtn');
const withdrawBtn = document.getElementById('withdrawBtn');
const withdrawInfo = document.getElementById('withdrawInfo');
const userName = document.getElementById('userName');
const dailyPlayEl = document.getElementById('dailyplay');

let currentUser = null;
let tapInterval = null;
let isHolding = false;

// Constants
const TAP_POINTS = 1;
const REF_BONUS = 100;
const FORM_BONUS = 100;
const ENERGY_MAX = 2500;
const DAILY_MAX_MS = 3600 * 1000; // 1 hour per day
const TAP_INTERVAL_MS = 300;

// Social media buttons
const socials = [
  {name:'YouTube', color:'social-youtube', url:'https://www.youtube.com/@Iqzad-Tokans-official'},
  {name:'X', color:'social-x', url:'https://x.com/IqzadO75376?t=8BcLAKdZJriwDAISnPlBoA&s=09'},
  {name:'Instagram', color:'social-instagram', url:'https://www.instagram.com/iqzadofficial?igsh=MTZ5aWRvaDM0cGNlZg=='},
  {name:'TikTok', color:'social-tiktok', url:'https://www.tiktok.com/@iqzad.official?_t=ZS-8zWUYESBUMT&_r=1'},
  {name:'Facebook', color:'social-facebook', url:'https://www.facebook.com/share/1GHNMPeX8W/'},
  {name:'WhatsApp', color:'social-whatsapp', url:'https://whatsapp.com/channel/0029Vb6C3kN2phHLMCcenQ1I'}
];
const googleForm = 'https://forms.gle/WTK4DaWgmuCx6yZR7';

// Render social buttons
socials.forEach(s=>{
  const a = document.createElement('a');
  a.className = s.color;
  a.href = s.url;
  a.target = "_blank";
  a.textContent = s.name;
  socialButtons.appendChild(a);
});

// --- Auth ---
loginBtn.addEventListener('click', async ()=>{
  if(currentUser){ await signOut(auth); return; }
  try{ await signInWithPopup(auth, provider); } catch(e){ alert('Login failed'); }
});

onAuthStateChanged(auth, async user=>{
  if(user){
    currentUser = user;
    loginBtn.textContent = 'Sign out';
    userName.textContent = `Hello, ${user.displayName}`;
    document.getElementById('game-section').classList.remove('hidden');
    document.getElementById('referral-section').classList.remove('hidden');
    document.getElementById('social-section').classList.remove('hidden');
    document.getElementById('withdraw-section').classList.remove('hidden');
    await ensureUser();
  } else {
    currentUser = null;
    loginBtn.textContent = 'Sign in with Google';
    userName.textContent = '';
  }
});

// --- Ensure user ---
async function ensureUser(){
  const userRef = ref(db,'users/'+currentUser.uid);
  const snap = await get(userRef);
  if(!snap.exists()){
    await set(userRef,{
      displayName: currentUser.displayName,
      points: 0,
      energy: ENERGY_MAX,
      lastTap: 0,
      referrals: [],
      referredBy: null,
      socialFormClaimed: false,
      refClaimed:false,
      dailyPlayed: 0
    });
  }
  updateUI();
}

// --- Update UI ---
async function updateUI(){
  const userRef = ref(db,'users/'+currentUser.uid);
  const snap = await get(userRef);
  if(!snap.exists()) return;
  const data = snap.val();

  pointsEl.textContent = data.points || 0;
  energyEl.textContent = data.energy || ENERGY_MAX;
  energyText.textContent = `${data.energy || ENERGY_MAX} / ${ENERGY_MAX}`;
  progressEl.style.width = `${Math.min(100, Math.round((data.energy/ENERGY_MAX)*100))}%`;
  refLinkInput.value = `${location.origin}${location.pathname}?ref=${currentUser.uid}`;
  refCountEl.textContent = (data.referrals || []).length;

  // daily play
  let dailySec = data.dailyPlayed || 0;
  const mm = String(Math.floor(dailySec/60)).padStart(2,'0');
  const ss = String(dailySec%60).padStart(2,'0');
  dailyPlayEl.textContent = `${mm}:${ss} / 01:00:00`;

  // Withdraw info
  const withdrawSnap = await get(ref(db,'withdrawals/'+currentUser.uid));
  if(withdrawSnap.exists()){
    const w = withdrawSnap.val();
    withdrawInfo.textContent = `Last withdrawal: ${w.points} pts — available on ${new Date(w.availableAt).toLocaleString()} (status: ${w.status})`;
  } else withdrawInfo.textContent = 'No withdrawals scheduled';
}

// --- Tap to earn ---
tapBtn.addEventListener('pointerdown', ()=>{
  if(!currentUser){ alert('Sign in first'); return; }
  if(isHolding) return;
  isHolding = true;
  doTap();
  tapInterval = setInterval(doTap, TAP_INTERVAL_MS);
});
window.addEventListener('pointerup', ()=>{
  clearInterval(tapInterval);
  isHolding = false;
});

// Tap function
async function doTap(){
  const userRef = ref(db,'users/'+currentUser.uid);
  await runTransaction(userRef, (data)=>{
    if(data){
      if(data.energy>0 && data.dailyPlayed*1000<DAILY_MAX_MS){
        data.points = (data.points||0)+TAP_POINTS;
        data.energy = (data.energy||0)-1;
        data.dailyPlayed = (data.dailyPlayed||0)+Math.ceil(TAP_INTERVAL_MS/1000);
      }
    }
    return data;
  });
  updateUI();
}

// Copy referral
copyRefBtn.addEventListener('click', ()=>{
  if(!currentUser){ alert('Sign in first'); return; }
  navigator.clipboard.writeText(refLinkInput.value).then(()=>alert('Referral link copied'));
});

// Google Form reward
formBtn.addEventListener('click', async ()=>{
  if(!currentUser){ alert('Sign in first'); return; }
  window.open(googleForm,'_blank');
  const userRef = ref(db,'users/'+currentUser.uid);
  await runTransaction(userRef, (data)=>{
    if(data && !data.socialFormClaimed){
      data.points = (data.points||0)+FORM_BONUS;
      data.socialFormClaimed = true;
    }
    return data;
  });
  updateUI();
});

// Withdraw
withdrawBtn.addEventListener('click', async ()=>{
  if(!currentUser){ alert('Sign in first'); return; }
  const method = prompt('Withdrawal method (wallet/UPI/contact):');
  if(!method) return;
  const confirmWithdraw = confirm('Confirm withdrawal of all points?');
  if(!confirmWithdraw) return;

  const userRef = ref(db,'users/'+currentUser.uid);
  const wRef = ref(db,'withdrawals/'+currentUser.uid);
  const snap = await get(userRef);
  const pts = snap.val().points || 0;
  if(pts<=0) return alert('No points to withdraw');

  await set(wRef,{
    points: pts,
    requestedAt: Date.now(),
    availableAt: Date.now() + 15*24*60*60*1000,
    status:'pending',
    method
  });
  await update(userRef,{points:0});
  updateUI();
});

// Initial UI
updateUI();
