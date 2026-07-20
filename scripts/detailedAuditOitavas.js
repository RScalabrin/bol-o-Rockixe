import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
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
  const [usersSnap, predsSnap, matchesSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'predictions')),
    getDocs(collection(db, 'matches'))
  ]);

  const matches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const oitavasMatches = matches.filter(m => m.id >= 'm089' && m.id <= 'm096');
  const finishedOitavas = oitavasMatches.filter(m => m.status === 'finished');

  const predsMap = {};
  predsSnap.forEach(d => {
    predsMap[d.id] = d.data().matches || {};
  });

  console.log('--- DETALHAMENTO DE PONTOS DE OITAVAS POR USUÁRIO ---');
  
  usersSnap.forEach(uDoc => {
    const userData = uDoc.data();
    const uid = uDoc.id;
    const userPreds = predsMap[uid] || {};

    console.log(`\n👤 ${userData.name.toUpperCase()} (Total atual no banco: ${userData.points} pts)`);

    finishedOitavas.forEach(match => {
      const pred = userPreds[match.id];
      if (!pred) {
        console.log(`  - Match ${match.id} (${match.teamAId} x ${match.teamBId}): Sem palpite`);
        return;
      }

      if (pred.scoreA === undefined || pred.scoreB === undefined || pred.scoreA === '' || pred.scoreB === '') {
        console.log(`  - Match ${match.id} (${match.teamAId} x ${match.teamBId}): Palpite em branco/inválido`);
        return;
      }

      const offA = parseInt(match.officialScoreA, 10);
      const offB = parseInt(match.officialScoreB, 10);
      const predA = parseInt(pred.scoreA, 10);
      const predB = parseInt(pred.scoreB, 10);

      const isKnockout = !match.groupId;
      let matchPoints = 0;
      let reason = "";

      // Check exact score
      if (predA === offA && predB === offB) {
        matchPoints += 6;
        reason = "Placar Exato (6 pts)";
      } else {
        // Check outcome
        const offOutcome = offA > offB ? 'A' : offA < offB ? 'B' : 'DRAW';
        const predOutcome = predA > predB ? 'A' : predA < predB ? 'B' : 'DRAW';
        if (offOutcome === predOutcome) {
          matchPoints += 3;
          reason = "Vencedor Regulamentar (3 pts)";
        } else {
          reason = "Errou Regulamentar (0 pts)";
        }
      }

      // Bônus de classificado no mata-mata
      if (isKnockout) {
        let offQualifier = null;
        if (offA > offB) offQualifier = match.teamAId;
        else if (offB > offA) offQualifier = match.teamBId;
        else offQualifier = match.officialPenaltyWinnerId;

        let predQualifier = null;
        if (predA > predB) predQualifier = match.teamAId;
        else if (predB > predA) predQualifier = match.teamBId;
        else predQualifier = pred.penaltyWinnerId;

        if (offQualifier && predQualifier && predQualifier === offQualifier) {
          const predIsDraw = (predA === predB);
          if (predIsDraw) {
            matchPoints += 3;
            reason += " + Classificado nos Pênaltis (+3 pts)";
          } else {
            if (matchPoints === 0) {
              matchPoints += 3;
              reason = "Apenas Classificado (+3 pts)";
            }
          }
        }
      }

      console.log(`  - Match ${match.id} (Oficial ${offA}x${offB} vs Palpite ${predA}x${predB}): ${reason} -> Ganhou: ${matchPoints} pts`);
    });
  });

  process.exit(0);
}

run().catch(console.error);
