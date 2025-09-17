import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getDatabase, ref, set, get, update, runTransaction, increment } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// Firebase config
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();

// UI Elements
const loginBtn = document.getElementById('loginBtn');
const tapBtn = document.getElementById('tapBtn');
const pointsEl = document.getElementById('points');
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

socials.forEach(s=>{
  const a = document.createElement('a');
  a.className = s.color;
  a.href = s.url;
  a.target = "_blank";
  a.textContent = s.name;
  socialButtons.appendChild(a);
});

// Google Form link
const googleForm = 'https://forms.gle/WTK4DaWgmuCx6yZR7';

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

// --- Ensure user record ---
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

// --- UI
