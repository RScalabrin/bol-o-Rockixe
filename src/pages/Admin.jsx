import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function Admin() {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [stages, setStages] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState('round_g1');
  const [newTeam, setNewTeam] = useState({ id: '', name: '', groupId: '' });
  const [newMatch, setNewMatch] = useState({ stageId: 'group_stage', groupId: 'group_a', teamAId: '', teamBId: '', kickoffLocal: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userData?.isAdmin) {
      fetchTeams();
      fetchUsers();
      fetchMatches();
      fetchStages();
      fetchRounds();
    }
  }, [userData]);

  const fetchStages = async () => {
    const snap = await getDocs(collection(db, 'stages'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => a.order - b.order);
    setStages(data);
  };

  const fetchRounds = async () => {
    const snap = await getDocs(collection(db, 'rounds'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => a.order - b.order);
    setRounds(data);
  };

  const fetchMatches = async () => {
    const snap = await getDocs(collection(db, 'matches'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Auto-correção silenciosa de partidas do dia 03/07 no Firestore
    for (const m of data) {
      if (m.id === 'm086' && m.kickoffLocal !== '2026-07-03T19:00:00-03:00') {
        try {
          await setDoc(doc(db, 'matches', 'm086'), { kickoffLocal: '2026-07-03T19:00:00-03:00' }, { merge: true });
          m.kickoffLocal = '2026-07-03T19:00:00-03:00';
          console.log('Partida m086 auto-corrigida para 19:00');
        } catch (e) {
          console.error('Erro ao auto-corrigir m086:', e);
        }
      }
      if (m.id === 'm088' && m.kickoffLocal !== '2026-07-03T15:00:00-03:00') {
        try {
          await setDoc(doc(db, 'matches', 'm088'), { kickoffLocal: '2026-07-03T15:00:00-03:00' }, { merge: true });
          m.kickoffLocal = '2026-07-03T15:00:00-03:00';
          console.log('Partida m088 auto-corrigida para 15:00');
        } catch (e) {
          console.error('Erro ao auto-corrigir m088:', e);
        }
      }
      if (m.id === 'm093' && m.kickoffLocal !== '2026-07-06T16:00:00-03:00') {
        try {
          await setDoc(doc(db, 'matches', 'm093'), { kickoffLocal: '2026-07-06T16:00:00-03:00' }, { merge: true });
          m.kickoffLocal = '2026-07-06T16:00:00-03:00';
          console.log('Partida m093 auto-corrigida para 16:00');
        } catch (e) {
          console.error('Erro ao auto-corrigir m093:', e);
        }
      }
      if (m.id === 'm094' && m.kickoffLocal !== '2026-07-06T21:00:00-03:00') {
        try {
          await setDoc(doc(db, 'matches', 'm094'), { kickoffLocal: '2026-07-06T21:00:00-03:00' }, { merge: true });
          m.kickoffLocal = '2026-07-06T21:00:00-03:00';
          console.log('Partida m094 auto-corrigida para 21:00');
        } catch (e) {
          console.error('Erro ao auto-corrigir m094:', e);
        }
      }
      if (m.id === 'm100' && m.kickoffLocal !== '2026-07-11T22:00:00-03:00') {
        try {
          await setDoc(doc(db, 'matches', 'm100'), { kickoffLocal: '2026-07-11T22:00:00-03:00' }, { merge: true });
          m.kickoffLocal = '2026-07-11T22:00:00-03:00';
          console.log('Partida m100 auto-corrigida para 22:00');
        } catch (e) {
          console.error('Erro ao auto-corrigir m100:', e);
        }
      }
    }
    
    data.sort((a, b) => new Date(a.kickoffLocal) - new Date(b.kickoffLocal));
    setMatches(data);
  };

  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, 'users'));
    const data = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    // Ordena por nome
    data.sort((a, b) => a.name.localeCompare(b.name));
    setUsers(data);
  };

  const fetchTeams = async () => {
    const snap = await getDocs(collection(db, 'teams'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => a.name.localeCompare(b.name));
    setTeams(data);
    setLoading(false);
  };

  if (!userData?.isAdmin) {
    return <Navigate to="/" />;
  }

  const handleAddTeam = async () => {
    if (!newTeam.id || !newTeam.name) return alert('ID e Nome obrigatórios');
    try {
      await setDoc(doc(db, 'teams', newTeam.id), newTeam);
      alert('Seleção salva com sucesso!');
      setNewTeam({ id: '', name: '', groupId: '' });
      fetchTeams();
    } catch (e) {
      alert('Erro ao salvar.');
    }
  };

  const handleDeleteTeam = async (id) => {
    if (!window.confirm('Certeza que deseja deletar?')) return;
    try {
      await deleteDoc(doc(db, 'teams', id));
      fetchTeams();
    } catch (e) {
      alert('Erro ao deletar.');
    }
  };

  const toggleUserStatus = async (user) => {
    const newStatus = user.status === 'pending' ? 'confirmed' : 'pending';
    try {
      await setDoc(doc(db, 'users', user.uid), { status: newStatus }, { merge: true });
      fetchUsers();
    } catch (e) {
      alert('Erro ao atualizar status.');
    }
  };

  const handleDeleteUser = async (uid) => {
    if (!window.confirm('Certeza que deseja deletar este usuário permanentemente? Todos os palpites e dados dele serão apagados.')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      await deleteDoc(doc(db, 'predictions', uid));
      fetchUsers();
    } catch(e) {
      alert('Erro ao excluir usuário');
    }
  };

  const toggleRoundStatus = async (round) => {
    const newStatus = round.predictionStatus === 'locked' ? 'open' : 'locked';
    try {
      await setDoc(doc(db, 'rounds', round.id), { predictionStatus: newStatus }, { merge: true });
      fetchRounds();
    } catch (e) {
      alert('Erro ao atualizar rodada.');
    }
  };

  const handleUpdateMatchTeams = async (matchId, teamAId, teamBId) => {
    try {
      await setDoc(doc(db, 'matches', matchId), { teamAId, teamBId }, { merge: true });
      fetchMatches();
    } catch (e) {
      alert('Erro ao salvar times.');
    }
  };

  // ============================================================
  // Metadados oficiais FIFA 2026 (horários BRT, estádios, cidades)
  // ============================================================
  const ALL_MATCH_META = {
    // 16-avos de Final
    m073: { stadium: 'SoFi Stadium',            city: 'Los Angeles',      kickoffLocal: '2026-06-28T16:00:00-03:00', roundName: '16-avos de Final' },
    m074: { stadium: 'Gillette Stadium',         city: 'Boston',           kickoffLocal: '2026-06-29T17:30:00-03:00', roundName: '16-avos de Final' },
    m075: { stadium: 'Estadio Monterrey',        city: 'Monterrey',        kickoffLocal: '2026-06-29T22:00:00-03:00', roundName: '16-avos de Final' },
    m076: { stadium: 'NRG Stadium',              city: 'Houston',          kickoffLocal: '2026-06-29T14:00:00-03:00', roundName: '16-avos de Final' },
    m077: { stadium: 'MetLife Stadium',          city: 'Nova York/NJ',     kickoffLocal: '2026-06-30T18:00:00-03:00', roundName: '16-avos de Final' },
    m078: { stadium: 'AT&T Stadium',             city: 'Dallas',           kickoffLocal: '2026-06-30T14:00:00-03:00', roundName: '16-avos de Final' },
    m079: { stadium: 'Estadio Azteca',           city: 'Cidade do México', kickoffLocal: '2026-06-30T22:00:00-03:00', roundName: '16-avos de Final' },
    m080: { stadium: 'Mercedes-Benz Stadium',   city: 'Atlanta',          kickoffLocal: '2026-07-01T13:00:00-03:00', roundName: '16-avos de Final' },
    m081: { stadium: "Levi's Stadium",           city: 'San Francisco/SJ', kickoffLocal: '2026-07-01T21:00:00-03:00', roundName: '16-avos de Final' },
    m082: { stadium: 'Lumen Field',              city: 'Seattle',          kickoffLocal: '2026-07-01T17:00:00-03:00', roundName: '16-avos de Final' },
    m083: { stadium: 'BMO Field',                city: 'Toronto',          kickoffLocal: '2026-07-02T20:00:00-03:00', roundName: '16-avos de Final' },
    m084: { stadium: 'SoFi Stadium',             city: 'Los Angeles',      kickoffLocal: '2026-07-02T16:00:00-03:00', roundName: '16-avos de Final' },
    m085: { stadium: 'BC Place',                 city: 'Vancouver',        kickoffLocal: '2026-07-03T00:00:00-03:00', roundName: '16-avos de Final' },
    m086: { stadium: 'Hard Rock Stadium',        city: 'Miami',            kickoffLocal: '2026-07-03T19:00:00-03:00', roundName: '16-avos de Final' },
    m087: { stadium: 'Arrowhead Stadium',        city: 'Kansas City',      kickoffLocal: '2026-07-03T22:30:00-03:00', roundName: '16-avos de Final' },
    m088: { stadium: 'AT&T Stadium',             city: 'Dallas',           kickoffLocal: '2026-07-03T15:00:00-03:00', roundName: '16-avos de Final' },
    // Oitavas de Final
    m089: { stadium: 'Lincoln Financial Field', city: 'Philadelphia',     kickoffLocal: '2026-07-04T18:00:00-03:00', roundName: 'Oitavas de Final' },
    m090: { stadium: 'NRG Stadium',             city: 'Houston',          kickoffLocal: '2026-07-04T14:00:00-03:00', roundName: 'Oitavas de Final' },
    m091: { stadium: 'MetLife Stadium',         city: 'Nova York/NJ',     kickoffLocal: '2026-07-05T17:00:00-03:00', roundName: 'Oitavas de Final' },
    m092: { stadium: 'Estadio Azteca',          city: 'Cidade do México', kickoffLocal: '2026-07-05T21:00:00-03:00', roundName: 'Oitavas de Final' },
    m093: { stadium: 'AT&T Stadium',            city: 'Dallas',           kickoffLocal: '2026-07-06T16:00:00-03:00', roundName: 'Oitavas de Final' },
    m094: { stadium: 'Lumen Field',             city: 'Seattle',          kickoffLocal: '2026-07-06T21:00:00-03:00', roundName: 'Oitavas de Final' },
    m095: { stadium: 'Mercedes-Benz Stadium',   city: 'Atlanta',          kickoffLocal: '2026-07-07T13:00:00-03:00', roundName: 'Oitavas de Final' },
    m096: { stadium: 'BC Place',               city: 'Vancouver',        kickoffLocal: '2026-07-07T17:00:00-03:00', roundName: 'Oitavas de Final' },
    // Quartas de Final
    m097: { stadium: 'Gillette Stadium',        city: 'Boston',           kickoffLocal: '2026-07-09T17:00:00-03:00', roundName: 'Quartas de Final' },
    m098: { stadium: 'SoFi Stadium',            city: 'Los Angeles',      kickoffLocal: '2026-07-10T16:00:00-03:00', roundName: 'Quartas de Final' },
    m099: { stadium: 'Hard Rock Stadium',       city: 'Miami',            kickoffLocal: '2026-07-11T18:00:00-03:00', roundName: 'Quartas de Final' },
    m100: { stadium: 'Arrowhead Stadium',       city: 'Kansas City',      kickoffLocal: '2026-07-11T22:00:00-03:00', roundName: 'Quartas de Final' },
    // Semifinais
    m101: { stadium: 'AT&T Stadium',            city: 'Dallas',           kickoffLocal: '2026-07-14T16:00:00-03:00', roundName: 'Semifinal' },
    m102: { stadium: 'Mercedes-Benz Stadium',   city: 'Atlanta',          kickoffLocal: '2026-07-15T16:00:00-03:00', roundName: 'Semifinal' },
    // 3° Lugar e Final
    m103: { stadium: 'Hard Rock Stadium',       city: 'Miami',            kickoffLocal: '2026-07-18T18:00:00-03:00', roundName: 'Disputa 3º Lugar' },
    m104: { stadium: 'MetLife Stadium',         city: 'Nova York/NJ',     kickoffLocal: '2026-07-19T16:00:00-03:00', roundName: 'Final' },
  };

  // ============================================================
  // Auxiliar: vencedor de uma partida (pelo resultado oficial salvo)
  // ============================================================
  const getWinnerFromMatch = (m) => {
    if (!m || m.status !== 'finished') return null;
    const sA = parseInt(m.officialScoreA, 10);
    const sB = parseInt(m.officialScoreB, 10);
    if (isNaN(sA) || isNaN(sB)) return null;
    if (sA > sB) return m.teamAId;
    if (sB > sA) return m.teamBId;
    return m.officialPenaltyWinnerId || null;
  };

  const getLoserFromMatch = (m) => {
    if (!m || m.status !== 'finished') return null;
    const sA = parseInt(m.officialScoreA, 10);
    const sB = parseInt(m.officialScoreB, 10);
    if (isNaN(sA) || isNaN(sB)) return null;
    if (sA > sB) return m.teamBId;
    if (sB > sA) return m.teamAId;
    if (m.officialPenaltyWinnerId === m.teamAId) return m.teamBId;
    if (m.officialPenaltyWinnerId === m.teamBId) return m.teamAId;
    return null;
  };

  // ============================================================
  // Preencher times SOMENTE da rodada atual selecionada
  // NÃO toca em nenhuma outra rodada
  // ============================================================
  const handleFillCurrentRound = async () => {
    const roundLabels = {
      round_32:    '16-avos de Final',
      round_16:    'Oitavas de Final',
      round_qf:    'Quartas de Final',
      round_sf:    'Semifinal',
      third_place: 'Disputa 3º Lugar',
      final:       'Final',
    };
    const roundLabel = roundLabels[selectedRound] || selectedRound;

    if (!window.confirm(
      `Preencher automaticamente os TIMES da rodada "${roundLabel}" com base nos resultados da fase anterior?\n\n` +
      `⚠️ Apenas esta rodada será alterada. As demais não serão tocadas.`
    )) return;

    // Helper: buscar partida no state local pelo id
    const getMatch = (id) => matches.find(x => x.id === id);

    // Calcular times para cada partida da rodada atual
    const updates = {}; // { matchId: { teamAId, teamBId } }

    if (selectedRound === 'round_32') {
      // ── 16-avos: baseado na classificação dos grupos ──
      const GROUP_IDS = ['group_a','group_b','group_c','group_d','group_e','group_f',
                         'group_g','group_h','group_i','group_j','group_k','group_l'];
      const standingsByGroup = {};
      for (const gid of GROUP_IDS) {
        const groupTeams = teams.filter(t => t.groupId === gid).map(t => t.id);
        const finishedGroupMatches = matches.filter(
          m => m.groupId === gid && m.status === 'finished' && m.teamAId && m.teamBId
        );
        const stats = {};
        groupTeams.forEach(id => { stats[id] = { id, p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0, groupId: gid }; });
        finishedGroupMatches.forEach(m => {
          const a = stats[m.teamAId]; const b = stats[m.teamBId];
          if (!a || !b) return;
          const gA = parseInt(m.officialScoreA,10); const gB = parseInt(m.officialScoreB,10);
          a.p++; b.p++; a.gf+=gA; a.ga+=gB; b.gf+=gB; b.ga+=gA;
          if (gA>gB){a.w++;a.pts+=3;b.l++;}else if(gB>gA){b.w++;b.pts+=3;a.l++;}else{a.d++;b.d++;a.pts+=1;b.pts+=1;}
        });
        standingsByGroup[gid] = Object.values(stats).sort((a,b)=>
          b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf
        );
      }
      const firstPlaces  = {}; const secondPlaces = {}; const thirdPlacesList = [];
      for (const gid of GROUP_IDS) {
        const list = standingsByGroup[gid] || [];
        if (list[0]) firstPlaces[gid]  = list[0].id;
        if (list[1]) secondPlaces[gid] = list[1].id;
        if (list[2]) thirdPlacesList.push({ id: list[2].id, groupId: gid, pts: list[2].pts, sg: list[2].gf-list[2].ga, gp: list[2].gf });
      }
      thirdPlacesList.sort((a,b)=>b.pts-a.pts||b.sg-a.sg||b.gp-a.gp);
      const bestEightThirds = thirdPlacesList.slice(0,8);
      const slots = [
        { matchId:'m074', groupWinner:'group_e', allowedGroups:['group_a','group_b','group_c','group_d','group_f'] },
        { matchId:'m077', groupWinner:'group_i', allowedGroups:['group_c','group_d','group_f','group_g','group_h'] },
        { matchId:'m079', groupWinner:'group_a', allowedGroups:['group_c','group_e','group_f','group_h','group_i'] },
        { matchId:'m080', groupWinner:'group_l', allowedGroups:['group_e','group_h','group_i','group_j','group_k'] },
        { matchId:'m081', groupWinner:'group_d', allowedGroups:['group_b','group_e','group_f','group_i','group_j'] },
        { matchId:'m082', groupWinner:'group_g', allowedGroups:['group_a','group_e','group_h','group_i','group_j'] },
        { matchId:'m085', groupWinner:'group_b', allowedGroups:['group_e','group_f','group_g','group_i','group_j'] },
        { matchId:'m087', groupWinner:'group_k', allowedGroups:['group_d','group_e','group_i','group_j','group_l'] },
      ];
      const thirdsAssignment = {}; const usedThirds = new Set();
      function backtrack(i) {
        if (i===slots.length) return true;
        for (const t of bestEightThirds) {
          if (usedThirds.has(t.id)) continue;
          if (slots[i].allowedGroups.includes(t.groupId)) {
            thirdsAssignment[slots[i].matchId]=t.id; usedThirds.add(t.id);
            if (backtrack(i+1)) return true;
            usedThirds.delete(t.id); delete thirdsAssignment[slots[i].matchId];
          }
        }
        return false;
      }
      if (!backtrack(0)) {
        const rem=[...bestEightThirds];
        for (const s of slots) { const t=rem.find(t=>s.allowedGroups.includes(t.groupId))||rem[0]; if(t){thirdsAssignment[s.matchId]=t.id; rem.splice(rem.indexOf(t),1);} }
      }
      const r32Mappings = {
        m073:{ teamA:secondPlaces['group_a'],    teamB:secondPlaces['group_b'] },
        m074:{ teamA:firstPlaces['group_e'],     teamB:thirdsAssignment['m074'] },
        m075:{ teamA:firstPlaces['group_f'],     teamB:secondPlaces['group_c'] },
        m076:{ teamA:firstPlaces['group_c'],     teamB:secondPlaces['group_f'] },
        m077:{ teamA:firstPlaces['group_i'],     teamB:thirdsAssignment['m077'] },
        m078:{ teamA:secondPlaces['group_e'],    teamB:secondPlaces['group_i'] },
        m079:{ teamA:firstPlaces['group_a'],     teamB:thirdsAssignment['m079'] },
        m080:{ teamA:firstPlaces['group_l'],     teamB:thirdsAssignment['m080'] },
        m081:{ teamA:firstPlaces['group_d'],     teamB:thirdsAssignment['m081'] },
        m082:{ teamA:firstPlaces['group_g'],     teamB:thirdsAssignment['m082'] },
        m083:{ teamA:secondPlaces['group_k'],    teamB:secondPlaces['group_l'] },
        m084:{ teamA:firstPlaces['group_h'],     teamB:secondPlaces['group_j'] },
        m085:{ teamA:firstPlaces['group_b'],     teamB:thirdsAssignment['m085'] },
        m086:{ teamA:firstPlaces['group_j'],     teamB:secondPlaces['group_h'] },
        m087:{ teamA:firstPlaces['group_k'],     teamB:thirdsAssignment['m087'] },
        m088:{ teamA:secondPlaces['group_d'],    teamB:secondPlaces['group_g'] },
      };
      for (const [mid, mp] of Object.entries(r32Mappings)) {
        updates[mid] = { teamAId: mp.teamA || null, teamBId: mp.teamB || null };
      }

    } else if (selectedRound === 'round_16') {
      // ── Oitavas: vencedores dos 16-avos ──
      const deps = {
        m089:{ depA:'m074', depB:'m077' },
        m090:{ depA:'m073', depB:'m075' },
        m091:{ depA:'m076', depB:'m078' },
        m092:{ depA:'m079', depB:'m080' },
        m093:{ depA:'m083', depB:'m084' },
        m094:{ depA:'m081', depB:'m082' },
        m095:{ depA:'m086', depB:'m088' },
        m096:{ depA:'m085', depB:'m087' },
      };
      for (const [mid, dep] of Object.entries(deps)) {
        updates[mid] = {
          teamAId: getWinnerFromMatch(getMatch(dep.depA)),
          teamBId: getWinnerFromMatch(getMatch(dep.depB)),
        };
      }

    } else if (selectedRound === 'round_qf') {
      // ── Quartas: vencedores das oitavas ──
      const deps = {
        m097:{ depA:'m089', depB:'m090' },
        m098:{ depA:'m093', depB:'m094' },
        m099:{ depA:'m091', depB:'m092' },
        m100:{ depA:'m095', depB:'m096' },
      };
      for (const [mid, dep] of Object.entries(deps)) {
        updates[mid] = {
          teamAId: getWinnerFromMatch(getMatch(dep.depA)),
          teamBId: getWinnerFromMatch(getMatch(dep.depB)),
        };
      }

    } else if (selectedRound === 'round_sf') {
      // ── Semis: vencedores das quartas ──
      const deps = {
        m101:{ depA:'m097', depB:'m098' },
        m102:{ depA:'m099', depB:'m100' },
      };
      for (const [mid, dep] of Object.entries(deps)) {
        updates[mid] = {
          teamAId: getWinnerFromMatch(getMatch(dep.depA)),
          teamBId: getWinnerFromMatch(getMatch(dep.depB)),
        };
      }

    } else if (selectedRound === 'third_place') {
      // ── 3° lugar: perdedores das semis ──
      updates['m103'] = {
        teamAId: getLoserFromMatch(getMatch('m101')),
        teamBId: getLoserFromMatch(getMatch('m102')),
      };

    } else if (selectedRound === 'final') {
      // ── Final: vencedores das semis ──
      updates['m104'] = {
        teamAId: getWinnerFromMatch(getMatch('m101')),
        teamBId: getWinnerFromMatch(getMatch('m102')),
      };
    } else {
      alert('Esta rodada não possui preenchimento automático.');
      return;
    }

    // Gravar somente as partidas desta rodada
    try {
      const batch = writeBatch(db);
      let count = 0;
      for (const [mid, upd] of Object.entries(updates)) {
        const meta = ALL_MATCH_META[mid];
        const payload = {
          teamAId: upd.teamAId || null,
          teamBId: upd.teamBId || null,
        };
        if (meta) {
          payload.stadium     = meta.stadium;
          payload.city        = meta.city;
          payload.kickoffLocal= meta.kickoffLocal;
          payload.roundName   = meta.roundName;
        }
        batch.update(doc(db, 'matches', mid), payload);
        count++;
      }
      // Renomear rodada (upsert idempotente)
      const roundRenames = {
        round_32:'16-avos de Final', round_16:'Oitavas de Final',
        round_qf:'Quartas de Final', round_sf:'Semifinal',
        third_place:'Disputa 3º Lugar', final:'Final',
      };
      if (roundRenames[selectedRound]) {
        batch.set(doc(db,'rounds',selectedRound),{name:roundRenames[selectedRound]},{merge:true});
      }
      await batch.commit();
      alert(`✅ Times da rodada "${roundLabel}" preenchidos! (${count} partidas atualizadas)\n\nAs outras rodadas não foram alteradas.`);
      fetchMatches();
      fetchRounds();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar os times da rodada.');
    }
  };

  const handleSaveMatchResult = async (matchId, scoreA, scoreB, penaltyWinnerId) => {
    try {
      await setDoc(doc(db, 'matches', matchId), { 
        officialScoreA: scoreA, 
        officialScoreB: scoreB,
        officialPenaltyWinnerId: penaltyWinnerId || null,
        status: 'finished'
      }, { merge: true });
      
      await recalculateAllScores(true); // Chamada automática e silenciosa
      alert('Resultado salvo e ranking atualizado com sucesso!');
      fetchMatches();
    } catch(e) {
      console.error(e);
      alert('Erro ao salvar resultado.');
    }
  };

  const recalculateAllScores = async (isAuto = false) => {
    try {
      const matchesSnap = await getDocs(collection(db, 'matches'));
      const finishedMatches = matchesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => m.status === 'finished');

      // Descobre o campeão se a final já acabou
      let championId = null;
      const finalMatch = finishedMatches.find(m => m.roundId === 'final');
      if (finalMatch) {
        if (finalMatch.officialScoreA > finalMatch.officialScoreB) championId = finalMatch.teamAId;
        else if (finalMatch.officialScoreB > finalMatch.officialScoreA) championId = finalMatch.teamBId;
      }

      const usersSnap = await getDocs(collection(db, 'users'));
      const usersData = [];
      let maxExactScores = 0;

      for (const userDoc of usersSnap.docs) {
        let totalPoints = 0;
        let totalExact = 0;

        const predSnap = await getDoc(doc(db, 'predictions', userDoc.id));
        if (predSnap.exists()) {
          const preds = predSnap.data().matches || {};

          for (const match of finishedMatches) {
            const pred = preds[match.id];
            if (!pred) continue;
            if (pred.scoreA === undefined || pred.scoreB === undefined || pred.scoreA === '' || pred.scoreB === '') continue; // Ignora palpite inválido

            const offA = parseInt(match.officialScoreA);
            const offB = parseInt(match.officialScoreB);
            const predA = parseInt(pred.scoreA);
            const predB = parseInt(pred.scoreB);

            const isKnockout = !match.groupId;
            let matchPoints = 0;

            // Check exact score
            if (predA === offA && predB === offB) {
              matchPoints += 6;
              totalExact += 1;
            } else {
              // Check outcome (winner or draw)
              const offOutcome = offA > offB ? 'A' : offA < offB ? 'B' : 'DRAW';
              const predOutcome = predA > predB ? 'A' : predA < predB ? 'B' : 'DRAW';
              if (offOutcome === predOutcome) {
                matchPoints += 3;
              }
            }

            // Bônus de "quem passa" no mata-mata
            if (isKnockout) {
              // Quem realmente avançou (oficial)
              let offQualifier = null;
              if (offA > offB) offQualifier = match.teamAId;
              else if (offB > offA) offQualifier = match.teamBId;
              else offQualifier = match.officialPenaltyWinnerId;

              // Quem o apostador previu que avançaria
              let predQualifier = null;
              if (predA > predB) predQualifier = match.teamAId;
              else if (predB > predA) predQualifier = match.teamBId;
              else predQualifier = pred.penaltyWinnerId;

              if (offQualifier && predQualifier && predQualifier === offQualifier) {
                const predIsDraw = (predA === predB);
                if (predIsDraw) {
                  // Se apostou empate e acertou quem passa nos pênaltis, ganha +3 pontos extras
                  matchPoints += 3;
                } else {
                  // Se apostou vitória de um time, e esse time passou:
                  // Ele ganha +3 pontos se e somente se ele NÃO ganhou pontos na primeira parte (matchPoints === 0)
                  if (matchPoints === 0) {
                    matchPoints += 3;
                  }
                }
              }
            }

            totalPoints += matchPoints;

          }
        }
        
        if (totalExact > maxExactScores) maxExactScores = totalExact;

        usersData.push({
          id: userDoc.id,
          championTeamId: userDoc.data().championTeamId,
          basePoints: totalPoints,
          baseExact: totalExact
        });
      }

      const isTournamentFinished = !!championId;
      
      const batch = writeBatch(db);
      for (const u of usersData) {
        let finalPoints = u.basePoints;
        
        // Bônus de Maior Acertador de Exatos (SOMENTE NO FINAL DO TORNEIO)
        if (isTournamentFinished && maxExactScores > 0 && u.baseExact === maxExactScores) {
          finalPoints += 10;
        }
        
        // Bônus de Campeão
        if (isTournamentFinished && u.championTeamId === championId) {
          finalPoints += 10;
        }

        batch.update(doc(db, 'users', u.id), {
          points: finalPoints,
          exactScores: u.baseExact
        });
      }

      await batch.commit();
      
      if (!isAuto) {
        alert('Pontuações recalculadas com sucesso! Todos os bônus foram aplicados.');
      }
      
      fetchUsers(); // Atualiza a tela se necessário
    } catch (e) {
      console.error(e);
      if (!isAuto) alert('Erro ao recalcular pontuações.');
    }
  };

  return (
    <div>
      <h2 className="section-title"><span>Painel Admin</span></h2>
      
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '20px', paddingBottom: '5px' }}>
        <Button variant={activeTab === 'users' ? 'primary' : 'secondary'} onClick={() => setActiveTab('users')} style={{whiteSpace:'nowrap'}}>Usuários</Button>
        <Button variant={activeTab === 'stages' ? 'primary' : 'secondary'} onClick={() => setActiveTab('stages')} style={{whiteSpace:'nowrap'}}>Rodadas</Button>
        <Button variant={activeTab === 'teams' ? 'primary' : 'secondary'} onClick={() => setActiveTab('teams')} style={{whiteSpace:'nowrap'}}>Seleções</Button>
        <Button variant={activeTab === 'matches' ? 'primary' : 'secondary'} onClick={() => setActiveTab('matches')} style={{whiteSpace:'nowrap'}}>Jogos</Button>
      </div>

      {activeTab === 'users' && (
        <Card>
          <h3>Aprovar Participantes</h3>
          <div style={{ marginTop: '16px' }}>
            {users.map(u => (
              <div key={u.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', padding: '12px 0' }}>
                <div>
                  <strong style={{ display: 'block' }}>{u.name}</strong>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.phone}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: u.status === 'confirmed' ? 'var(--success)' : 'orange', fontWeight: 'bold' }}>
                    {u.status === 'confirmed' ? 'Pago ✅' : 'Pendente ⏳'}
                  </span>
                  <button 
                    onClick={() => toggleUserStatus(u)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: u.status === 'confirmed' ? 'orange' : 'var(--success)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {u.status === 'confirmed' ? 'Desfazer' : 'Confirmar Pagto'}
                  </button>
                  <button 
                    onClick={() => handleDeleteUser(u.uid)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--error)',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'stages' && (
        <Card>
          <h3>Liberar/Trancar Rodadas</h3>
          <p style={{fontSize:'14px', color:'var(--text-muted)', marginTop:'10px', marginBottom: '20px'}}>
            Rodadas trancadas impedem qualquer usuário de palpitar nos jogos daquela rodada, independente do horário do jogo.
          </p>
          <div style={{ marginTop: '16px' }}>
            {rounds.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', padding: '12px 0' }}>
                <strong style={{ display: 'block' }}>{r.name}</strong>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: r.predictionStatus === 'open' ? 'var(--success)' : 'var(--error)' }}>
                    {r.predictionStatus === 'open' ? 'Aberta' : 'Trancada'}
                  </span>
                  <button 
                    onClick={() => toggleRoundStatus(r)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: r.predictionStatus === 'open' ? 'var(--error)' : 'var(--success)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {r.predictionStatus === 'open' ? 'Trancar' : 'Liberar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'teams' && (
        <Card>
          <h3>Gerenciar Seleções</h3>
          
          <div style={{ margin: '20px 0', padding: '16px', background: 'var(--bg-dark)', borderRadius: '8px' }}>
            <h4 style={{marginBottom:'10px'}}>Nova Seleção</h4>
            <Input label="ID (ex: brazil)" value={newTeam.id} onChange={e => setNewTeam({...newTeam, id: e.target.value})} />
            <Input label="Nome (ex: Brasil)" value={newTeam.name} onChange={e => setNewTeam({...newTeam, name: e.target.value})} />
            <Input label="Grupo (ex: group_g)" value={newTeam.groupId} onChange={e => setNewTeam({...newTeam, groupId: e.target.value})} />
            <Button onClick={handleAddTeam}>Adicionar / Salvar</Button>
          </div>

          <div>
            {teams.map(team => (
              <div key={team.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems:'center', borderBottom: '1px solid var(--border-color)', padding: '10px 0' }}>
                <div>
                  <strong>{team.name}</strong> <span style={{fontSize:'12px', color:'var(--text-muted)'}}>({team.groupId})</span>
                </div>
                <button onClick={() => handleDeleteTeam(team.id)} style={{ background:'transparent', color:'var(--error)', border:'none', cursor:'pointer' }}>Excluir</button>
              </div>
            ))}
          </div>
        </Card>
      )}
      
      {activeTab === 'matches' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '10px', flexWrap: 'wrap' }}>
            <h3>Resultados Oficiais</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button onClick={handleFillCurrentRound} style={{ background: 'var(--primary)', color: '#000', border: 'none', fontWeight: 600 }}>
                ⚡ Preencher Times desta Rodada
              </Button>
              <Button onClick={() => recalculateAllScores(false)} style={{ background: 'var(--success)', color: '#fff', border: 'none' }}>
                🔄 Recalcular Pontos
              </Button>
            </div>
          </div>
          <p style={{fontSize:'13px', color:'var(--text-muted)', marginTop:'8px', marginBottom:'16px'}}>
            Selecione a rodada, escolha os times de cada jogo e lance resultados.
          </p>

          <select 
            value={selectedRound} 
            onChange={e => setSelectedRound(e.target.value)}
            style={{width:'100%', padding:'12px', borderRadius:'8px', marginBottom:'20px', background:'var(--bg-dark)', color:'#fff', border:'1px solid var(--border-color)', fontSize:'15px'}}
          >
            {rounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          {matches.filter(m => m.roundId === selectedRound).map(m => (
            <MatchRow 
              key={m.id} 
              match={m} 
              teams={teams} 
              onSave={handleSaveMatchResult}
              onUpdateTeams={handleUpdateMatchTeams}
            />
          ))}

          {matches.filter(m => m.roundId === selectedRound).length === 0 && (
            <p style={{textAlign:'center', color:'var(--text-muted)', padding:'20px'}}>Nenhum jogo nesta rodada.</p>
          )}
        </Card>
      )}
    </div>
  );
}

function MatchRow({ match: m, teams, onSave, onUpdateTeams }) {
  const [localScoreA, setLocalScoreA] = useState(m.officialScoreA ?? '');
  const [localScoreB, setLocalScoreB] = useState(m.officialScoreB ?? '');
  const [teamA, setTeamA] = useState(m.teamAId || '');
  const [teamB, setTeamB] = useState(m.teamBId || '');
  const [localPenaltyWinnerId, setLocalPenaltyWinnerId] = useState(m.officialPenaltyWinnerId || '');
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setTeamA(m.teamAId || '');
    setTeamB(m.teamBId || '');
  }, [m.teamAId, m.teamBId]);

  const selStyle = { width:'100%', padding:'8px', borderRadius:'6px', background:'var(--bg-dark)', color:'#fff', border:'1px solid var(--border-color)', fontSize:'13px' };
  const teamAName = teams.find(t => t.id === m.teamAId)?.name;
  const teamBName = teams.find(t => t.id === m.teamBId)?.name;
  const isFinished = m.status === 'finished';
  
  const isKnockout = !m.groupId;
  const isTie = localScoreA !== '' && localScoreB !== '' && localScoreA === localScoreB;
  const needsPenaltyWinner = isKnockout && isTie;

  const handleSaveTeams = async () => {
    if (!teamA || !teamB) return alert('Selecione as duas seleções.');
    setSaving(true);
    await onUpdateTeams(m.id, teamA, teamB);
    setSaving(false);
    setIsEditing(false);
  };

  return (
    <div style={{ borderBottom: '1px solid var(--border-color)', padding:'16px 0', display:'flex', flexDirection:'column', gap:'10px' }}>
      {/* Header: número, grupo, data, estádio */}
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>
          Jogo {m.matchNumber} {m.groupId ? `• ${m.groupId.replace('group_','Grupo ').toUpperCase()}` : ''}
        </div>
        <div style={{ fontSize:'14px', fontWeight:'bold', color:'var(--primary)', marginTop:'2px' }}>
          {new Date(m.kickoffLocal).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
        </div>
        <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{m.stadium} — {m.city}</div>
      </div>

      {/* Seleção de times */}
      {!m.teamAId || !m.teamBId || isEditing ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          <select value={teamA} onChange={e => setTeamA(e.target.value)} style={selStyle}>
            <option value=''>Seleção A...</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div style={{textAlign:'center', fontSize:'12px', color:'var(--text-muted)'}}>VS</div>
          <select value={teamB} onChange={e => setTeamB(e.target.value)} style={selStyle}>
            <option value=''>Seleção B...</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button onClick={handleSaveTeams} disabled={saving} style={{flex: 1, padding:'8px', fontSize:'13px'}}>
              {saving ? 'Salvando...' : 'Salvar Times'}
            </Button>
            {m.teamAId && m.teamBId && (
              <Button variant="secondary" onClick={() => setIsEditing(false)} style={{flex: 1, padding:'8px', fontSize:'13px'}}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Times já definidos + placar */}
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'12px' }}>
            <div style={{ flex:1, textAlign:'right', fontWeight:'bold', fontSize:'15px' }}>{teamAName}</div>
            <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
              <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength="2" value={localScoreA} onChange={e => setLocalScoreA(e.target.value)}
                style={{ width:'38px', height:'38px', textAlign:'center', fontSize:'18px', borderRadius:'6px', border:'1px solid var(--border-color)', background:'var(--bg-dark)', color:'#fff' }} />
              <span style={{fontWeight:'bold'}}>X</span>
              <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength="2" value={localScoreB} onChange={e => setLocalScoreB(e.target.value)}
                style={{ width:'38px', height:'38px', textAlign:'center', fontSize:'18px', borderRadius:'6px', border:'1px solid var(--border-color)', background:'var(--bg-dark)', color:'#fff' }} />
            </div>
            <div style={{ flex:1, textAlign:'left', fontWeight:'bold', fontSize:'15px' }}>{teamBName}</div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '4px' }}>
            <button 
              onClick={() => setIsEditing(true)}
              style={{ background: 'none', border: 'none', color: isFinished ? 'var(--warning)' : 'var(--primary)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
            >
              {isFinished ? '🔧 Corrigir Times' : '✏️ Editar Confronto'}
            </button>
          </div>

          {needsPenaltyWinner && !isFinished && (
            <div style={{ marginTop: '10px', padding: '10px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid rgba(212,168,67,0.3)', alignSelf: 'center' }}>
              <div style={{ fontSize: '11px', textAlign: 'center', marginBottom: '5px', color: 'var(--primary)' }}>QUEM VENCEU NOS PÊNALTIS?</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setLocalPenaltyWinnerId(m.teamAId)} style={{ padding: '6px', borderRadius: '4px', background: localPenaltyWinnerId === m.teamAId ? 'var(--primary)' : 'transparent', color: localPenaltyWinnerId === m.teamAId ? '#000' : '#fff', border: '1px solid var(--primary)', cursor: 'pointer', fontSize: '12px' }}>{teamAName}</button>
                <button onClick={() => setLocalPenaltyWinnerId(m.teamBId)} style={{ padding: '6px', borderRadius: '4px', background: localPenaltyWinnerId === m.teamBId ? 'var(--primary)' : 'transparent', color: localPenaltyWinnerId === m.teamBId ? '#000' : '#fff', border: '1px solid var(--primary)', cursor: 'pointer', fontSize: '12px' }}>{teamBName}</button>
              </div>
            </div>
          )}

          <Button variant="secondary" onClick={() => {
              if (needsPenaltyWinner && !localPenaltyWinnerId) return alert('Selecione quem venceu nos pênaltis.');
              onSave(m.id, parseInt(localScoreA,10), parseInt(localScoreB,10), localPenaltyWinnerId);
            }}
              style={{ alignSelf:'center', padding:'6px 14px', fontSize:'12px', width:'auto', marginTop: '10px' }}>
              {isFinished ? '🔁 Corrigir Resultado' : 'Salvar Resultado Oficial'}
            </Button>
          {isFinished && (
            <div style={{textAlign:'center', fontSize:'12px', color:'var(--success)', fontWeight:'bold'}}>✓ ENCERRADO ({m.officialScoreA} x {m.officialScoreB})</div>
          )}
        </>
      )}
    </div>
  );
}
