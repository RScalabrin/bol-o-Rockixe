import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const matchesSnap = await getDocs(collection(db, 'matches'));
  const matches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const finishedMatches = matches.filter(m => m.status === 'finished');

  console.log(`--- INVESTIGAÇÃO DE BÔNUS FINAL ---`);

  // 1. Encontrar o campeão - lógica EXATAMENTE igual ao Admin.jsx
  let championId = null;
  const finalMatch = finishedMatches.find(m => m.roundId === 'final');
  console.log(`\n1. Jogo da final:`);
  if (finalMatch) {
    console.log(`   - ID: ${finalMatch.id} | Time A: ${finalMatch.teamAId} | Time B: ${finalMatch.teamBId}`);
    console.log(`   - Placar: ${finalMatch.officialScoreA} x ${finalMatch.officialScoreB}`);
    console.log(`   - PenaltyWinner: ${finalMatch.officialPenaltyWinnerId}`);
    console.log(`   - roundId: "${finalMatch.roundId}"`);
    if (parseInt(finalMatch.officialScoreA) > parseInt(finalMatch.officialScoreB)) {
      championId = finalMatch.teamAId;
    } else if (parseInt(finalMatch.officialScoreB) > parseInt(finalMatch.officialScoreA)) {
      championId = finalMatch.teamBId;
    } else if (finalMatch.officialPenaltyWinnerId) {
      // A lógica atual do Admin.jsx NÃO pega pênaltis na final! Só verifica scorA > scoreB
      championId = null; // Isso pode ser um bug!
    }
    console.log(`   - Campeão detectado pela lógica atual: ${championId || 'NÃO DETECTADO!'}`);
  } else {
    console.log(`   ❌ JOGO DA FINAL NÃO ENCONTRADO! Verificando roundIds disponíveis...`);
    const roundIds = [...new Set(finishedMatches.map(m => m.roundId))];
    console.log(`   roundIds disponíveis nos jogos finalizados: ${JSON.stringify(roundIds)}`);
  }

  // 2. Verificar todos os jogos "mata-mata" para achar possível final
  console.log(`\n2. Jogos do mata-mata finalizados:`);
  const knockoutMatches = finishedMatches.filter(m => !m.groupId);
  knockoutMatches.sort((a, b) => a.id.localeCompare(b.id));
  knockoutMatches.forEach(m => {
    console.log(`   ${m.id} [roundId="${m.roundId}"] ${m.teamAId} ${m.officialScoreA}x${m.officialScoreB} ${m.teamBId} | PenaltyWinner: ${m.officialPenaltyWinnerId || 'N/A'}`);
  });

  // 3. Verificar usuários e qual campeão apostaram
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log(`\n3. Apostas de campeão dos participantes:`);
  usersSnap.forEach(u => {
    const data = u.data();
    const acertou = championId && data.championTeamId === championId;
    console.log(`   ${data.name.padEnd(22)}: Apostou = ${data.championTeamId || 'N/A'} | Campeão = ${championId || '?'} | Acertou: ${acertou ? '✅ SIM' : '❌ NÃO'} | Pts atual: ${data.points}`);
  });

  // 4. Verificar max de acertos exatos
  const predsSnap = await getDocs(collection(db, 'predictions'));
  const predsMap = {};
  predsSnap.forEach(d => { predsMap[d.id] = d.data().matches || {}; });

  let maxExactScores = 0;
  const userExacts = {};
  usersSnap.forEach(uDoc => {
    const uid = uDoc.id;
    const preds = predsMap[uid] || {};
    let exact = 0;
    finishedMatches.forEach(match => {
      const pred = preds[match.id];
      if (!pred || pred.scoreA === undefined || pred.scoreA === '') return;
      if (parseInt(pred.scoreA) === parseInt(match.officialScoreA) && parseInt(pred.scoreB) === parseInt(match.officialScoreB)) {
        exact++;
      }
    });
    userExacts[uid] = { name: uDoc.data().name, exact, points: uDoc.data().points };
    if (exact > maxExactScores) maxExactScores = exact;
  });

  console.log(`\n4. Acertos de placar exato por participante (max = ${maxExactScores}):`);
  Object.values(userExacts).forEach(u => {
    const isMax = u.exact === maxExactScores;
    console.log(`   ${u.name.padEnd(22)}: Exatos = ${u.exact} ${isMax ? '🏆 MAIOR!' : ''} | Pts atual: ${u.points}`);
  });

  process.exit(0);
}

run().catch(console.error);
