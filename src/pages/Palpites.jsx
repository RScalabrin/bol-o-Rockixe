import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { isAfter, parseISO } from 'date-fns';
import { TEAM_FLAGS } from '../utils/flags';

const calculateMatchPoints = (match, pred) => {
  if (pred.scoreA === undefined || pred.scoreB === undefined || pred.scoreA === '' || pred.scoreB === '') {
    return {
      points: 0,
      description: "Sem palpite (0 pts)",
      colorBg: "rgba(239, 68, 68, 0.1)",
      colorText: "#EF4444",
      colorBorder: "rgba(239, 68, 68, 0.2)"
    };
  }

  const offA = parseInt(match.officialScoreA, 10);
  const offB = parseInt(match.officialScoreB, 10);
  const predA = parseInt(pred.scoreA, 10);
  const predB = parseInt(pred.scoreB, 10);

  const isKnockout = !match.groupId;
  let points = 0;
  let isExact = false;
  let isOutcomeCorrect = false;

  // Check exact score
  if (predA === offA && predB === offB) {
    points += 6;
    isExact = true;
  } else {
    // Check outcome (winner or draw)
    const offOutcome = offA > offB ? 'A' : offA < offB ? 'B' : 'DRAW';
    const predOutcome = predA > predB ? 'A' : predA < predB ? 'B' : 'DRAW';
    if (offOutcome === predOutcome) {
      points += 3;
      isOutcomeCorrect = true;
    }
  }

  // Bônus de "quem passa" no mata-mata
  let isQualifierCorrect = false;
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
      isQualifierCorrect = true;
      const predIsDraw = (predA === predB);
      if (predIsDraw) {
        // Se apostou empate e acertou quem passa nos pênaltis, ganha +3 pontos extras
        points += 3;
      } else {
        // Se apostou vitória de um time, e esse time passou:
        // Ele ganha +3 pontos se e somente se ele NÃO ganhou pontos na primeira parte (ou seja, se points === 0)
        // Isso cobre o caso em que ele apostou vitória, o jogo deu empate, mas o time dele passou nos pênaltis.
        if (points === 0) {
          points += 3;
        }
      }
    }
  }

  // Generate description and colors
  let desc = "";
  let bg = "rgba(107, 107, 128, 0.1)";
  let text = "var(--text-secondary)";
  let border = "var(--border-color)";

  if (points === 9) {
    desc = `🔥 Placar Exato + Classificado (+9 pts)`;
    bg = "rgba(52, 211, 153, 0.1)";
    text = "var(--success)";
    border = "rgba(52, 211, 153, 0.25)";
  } else if (points === 6) {
    if (isExact) {
      desc = `🔥 Placar Exato (+6 pts)`;
      bg = "rgba(52, 211, 153, 0.1)";
      text = "var(--success)";
      border = "rgba(52, 211, 153, 0.25)";
    } else {
      desc = `👍 Empate + Classificado (+6 pts)`;
      bg = "rgba(212, 168, 67, 0.1)";
      text = "var(--primary)";
      border = "rgba(212, 168, 67, 0.25)";
    }
  } else if (points === 3) {
    if (isOutcomeCorrect) {
      desc = `👍 Acertou Vencedor (+3 pts)`;
      bg = "rgba(212, 168, 67, 0.1)";
      text = "var(--primary)";
      border = "rgba(212, 168, 67, 0.25)";
    } else {
      desc = `⚽ Apenas Classificado (+3 pts)`;
      bg = "rgba(251, 191, 36, 0.1)";
      text = "var(--warning)";
      border = "rgba(251, 191, 36, 0.25)";
    }
  } else {
    desc = `❌ Errou (0 pts)`;
    bg = "rgba(107, 107, 128, 0.1)";
    text = "var(--text-muted)";
    border = "rgba(107, 107, 128, 0.15)";
  }

  return {
    points,
    description: desc,
    colorBg: bg,
    colorText: text,
    colorBorder: border
  };
};

export function Palpites() {
  const { userData, currentUser } = useAuth();
  const [rounds, setRounds] = useState([]);
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState({});
  const [predictions, setPredictions] = useState({});
  const [selectedRound, setSelectedRound] = useState('round_g1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [roundsSnap, matchesSnap, teamsSnap, predsSnap] = await Promise.all([
          getDocs(collection(db, 'rounds')),
          getDocs(collection(db, 'matches')),
          getDocs(collection(db, 'teams')),
          getDoc(doc(db, 'predictions', currentUser.uid))
        ]);

        const roundsData = roundsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        roundsData.sort((a, b) => a.order - b.order);

        const matchesData = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        matchesData.sort((a, b) => new Date(a.kickoffLocal) - new Date(b.kickoffLocal));

        const teamsObj = {};
        teamsSnap.docs.forEach(d => { teamsObj[d.id] = d.data(); });

        setRounds(roundsData);
        setMatches(matchesData);
        setTeams(teamsObj);

        if (predsSnap.exists()) {
          setPredictions(predsSnap.data().matches || {});
        }
      } catch (error) {
        console.error("Erro ao buscar dados", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  const handleScoreChange = (matchId, team, value) => {
    if (value !== '' && !/^\d+$/.test(value)) return;
    setPredictions(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team]: value,
        // Limpa o penaltyWinnerId ao alterar o placar (pode deixar de ser empate)
        ...(team === 'scoreA' || team === 'scoreB' ? { penaltyWinnerId: undefined } : {})
      }
    }));
  };

  // Handler dedicado para seleção do vencedor nos pênaltis (ID do time não é numérico)
  const handlePenaltyWinner = (matchId, teamId) => {
    setPredictions(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], penaltyWinnerId: teamId }
    }));
  };

  const handleSavePrediction = async (match) => {
    const round = rounds.find(r => r.id === match.roundId);
    const isLockedByTime = isAfter(new Date(), parseISO(match.kickoffLocal));
    const isLockedByRound = round?.predictionStatus === 'locked';
    if (isLockedByTime || isLockedByRound) {
      alert("Palpite bloqueado!");
      return;
    }

    const pred = predictions[match.id] || {};
    if (pred.scoreA === undefined || pred.scoreB === undefined || pred.scoreA === '' || pred.scoreB === '') {
      alert("Preencha o placar das duas equipes.");
      return;
    }

    setSaving(true);
    try {
      const predRef = doc(db, 'predictions', currentUser.uid);
      const docSnap = await getDoc(predRef);
      const scoreAVal = parseInt(pred.scoreA, 10);
      const scoreBVal = parseInt(pred.scoreB, 10);
      const predictionData = {
        scoreA: scoreAVal,
        scoreB: scoreBVal,
        updatedAt: new Date().toISOString()
      };
      if (scoreAVal === scoreBVal && pred.penaltyWinnerId) {
        predictionData.penaltyWinnerId = pred.penaltyWinnerId;
      }
      const newData = {
        ...((docSnap.exists() ? docSnap.data().matches : {}) || {}),
        [match.id]: predictionData
      };
      await setDoc(predRef, { matches: newData }, { merge: true });
      alert("Palpite salvo! ✓");
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--text-muted)' }}>Carregando jogos...</div>;

  if (userData?.status === 'pending') {
    return (
      <div className="animate-in">
        <h2 className="section-title">Meus <span>Palpites</span></h2>
        <div className="card" style={{ borderColor: 'rgba(251,191,36,0.3)', textAlign: 'center', padding: '30px 20px', marginTop: '40px' }}>
          <div style={{ fontSize: 40, marginBottom: 15 }}>🔒</div>
          <h3 style={{ color: 'var(--warning)', fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Palpites Bloqueados</h3>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            Você precisa confirmar o pagamento da inscrição para começar a jogar.
            <br/><br/>
            Acesse a aba <strong style={{color: '#fff'}}>Início</strong> para ver a chave PIX e enviar o comprovante para o administrador.
          </p>
        </div>
      </div>
    );
  }

  const currentRound = rounds.find(r => r.id === selectedRound);
  const roundMatches = matches.filter(m => m.roundId === selectedRound);

  return (
    <div className="animate-in">
      <h2 className="section-title">Meus <span>Palpites</span></h2>

      {/* Round selector pills */}
      <div className="round-selector">
        {rounds.map(r => (
          <button
            key={r.id}
            className={`round-selector__btn ${selectedRound === r.id ? 'round-selector__btn--active' : ''}`}
            onClick={() => setSelectedRound(r.id)}
          >
            {r.name.replace('Fase de Grupos - ', '')}
          </button>
        ))}
      </div>

      {/* Round status */}
      {currentRound && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <span className={`status-badge ${currentRound.predictionStatus === 'open' ? 'status-badge--open' : 'status-badge--locked'}`}>
            {currentRound.predictionStatus === 'open' ? '🟢 Aberta para palpites' : '🔒 Rodada bloqueada'}
          </span>
        </div>
      )}

      {/* Matches */}
      {roundMatches.map(match => {
        const isLockedByTime = isAfter(new Date(), parseISO(match.kickoffLocal));
        const isLockedByRound = currentRound?.predictionStatus === 'locked';
        const isLocked = isLockedByTime || isLockedByRound;
        const pred = predictions[match.id] || {};
        const hasSaved = pred.scoreA !== undefined && pred.scoreB !== undefined && pred.scoreA !== '' && pred.scoreB !== '';
        const teamA = teams[match.teamAId];
        const teamB = teams[match.teamBId];

        const isKnockout = !match.groupId;
        const predAInt = parseInt(pred.scoreA, 10);
        const predBInt = parseInt(pred.scoreB, 10);
        const hasValidScore = pred.scoreA !== undefined && pred.scoreB !== undefined && pred.scoreA !== '' && pred.scoreB !== '' && !isNaN(predAInt) && !isNaN(predBInt);
        const needsPenaltyWinner = isKnockout && hasValidScore && predAInt === predBInt;
        const isSaveDisabled = saving || (needsPenaltyWinner && !pred.penaltyWinnerId);

        const groupLabel = match.groupId ? match.groupId.replace('group_', 'Grupo ').toUpperCase() : (currentRound?.name || '');

        if (!match.teamAId || !match.teamBId) {
          return (
            <div key={match.id} className={`match-card match-card--locked`}>
              <div className="match-card__header">
                <div className="match-card__group">{groupLabel}</div>
                <div className="match-card__time">
                  {new Date(match.kickoffLocal).toLocaleString('pt-BR', { 
                    day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' 
                  })}
                </div>
                <div className="match-card__stadium">{match.stadium}</div>
              </div>
              <div className="match-card__teams" style={{ justifyContent: 'center', opacity: 0.6, padding: '20px 0' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>A DEFINIR</div>
              </div>
              <div className="match-card__action" style={{ textAlign: 'center' }}>
                <span className="match-card__badge match-card__badge--locked">Aguardando Classificação</span>
              </div>
            </div>
          );
        }

        return (
          <div key={match.id} className={`match-card ${isLocked ? 'match-card--locked' : ''} ${hasSaved ? 'match-card--saved' : ''}`}>
            <div className="match-card__header">
              <div className="match-card__group">{groupLabel}</div>
              <div className="match-card__time">
                {new Date(match.kickoffLocal).toLocaleString('pt-BR', { 
                  day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' 
                })}
              </div>
              <div className="match-card__stadium">{match.stadium}</div>
            </div>

            <div className="match-card__teams">
              <div className="match-card__team match-card__team--left">
                <div className="match-card__team-name" style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ marginRight: '6px', fontSize: '16px' }}>{TEAM_FLAGS[match.teamAId] || '🏳️'}</span>
                  {teamA?.name || '—'}
                </div>
              </div>

              <div className="match-card__scores">
                <input
                  className="match-card__score-input"
                  type="text" inputMode="numeric" pattern="[0-9]*" maxLength="2"
                  value={pred.scoreA ?? ''}
                  onChange={e => handleScoreChange(match.id, 'scoreA', e.target.value)}
                  disabled={isLocked}
                />
                <span className="match-card__vs">×</span>
                <input
                  className="match-card__score-input"
                  type="text" inputMode="numeric" pattern="[0-9]*" maxLength="2"
                  value={pred.scoreB ?? ''}
                  onChange={e => handleScoreChange(match.id, 'scoreB', e.target.value)}
                  disabled={isLocked}
                />
              </div>

              <div className="match-card__team match-card__team--right">
                <div className="match-card__team-name" style={{ display: 'flex', alignItems: 'center' }}>
                  {teamB?.name || '—'}
                  <span style={{ marginLeft: '6px', fontSize: '16px' }}>{TEAM_FLAGS[match.teamBId] || '🏳️'}</span>
                </div>
              </div>
            </div>

            {needsPenaltyWinner && (
              <div style={{ marginTop: '15px', padding: '12px', background: 'var(--bg-dark)', borderRadius: '8px', border: '1px solid rgba(212,168,67,0.2)' }}>
                <div style={{ fontSize: '12px', color: 'var(--primary)', textAlign: 'center', marginBottom: '8px', fontWeight: 600 }}>
                  QUEM AVANÇA NOS PÊNALTIS?
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={() => handlePenaltyWinner(match.id, match.teamAId)}
                    disabled={isLocked}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '6px',
                      border: pred.penaltyWinnerId === match.teamAId ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      background: pred.penaltyWinnerId === match.teamAId ? 'rgba(212,168,67,0.2)' : 'transparent',
                      color: pred.penaltyWinnerId === match.teamAId ? 'var(--primary)' : '#fff',
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      fontWeight: 700, fontSize: '14px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {TEAM_FLAGS[match.teamAId] || '🏳️'} {teamA?.name}
                  </button>
                  <button 
                    onClick={() => handlePenaltyWinner(match.id, match.teamBId)}
                    disabled={isLocked}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '6px',
                      border: pred.penaltyWinnerId === match.teamBId ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      background: pred.penaltyWinnerId === match.teamBId ? 'rgba(212,168,67,0.2)' : 'transparent',
                      color: pred.penaltyWinnerId === match.teamBId ? 'var(--primary)' : '#fff',
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      fontWeight: 700, fontSize: '14px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {TEAM_FLAGS[match.teamBId] || '🏳️'} {teamB?.name}
                  </button>
                </div>
              </div>
            )}

            <div className="match-card__action" style={{ textAlign: 'center', marginTop: needsPenaltyWinner ? '15px' : '0' }}>
              {!isLocked && (
                <Button size="sm" onClick={() => handleSavePrediction(match)} disabled={isSaveDisabled}>
                  Salvar Palpite
                </Button>
              )}
              {isLocked && match.status !== 'finished' && hasSaved && (
                <span className="match-card__badge match-card__badge--saved">✓ Palpite salvo</span>
              )}
              {isLocked && match.status !== 'finished' && !hasSaved && (
                <span className="match-card__badge match-card__badge--locked">🔒 Bloqueado</span>
              )}
              {isLocked && match.status === 'finished' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Resultado Oficial: <strong style={{ color: '#fff' }}>{match.officialScoreA} × {match.officialScoreB}</strong>
                    {match.officialPenaltyWinnerId && ` (Pênaltis: ${teams[match.officialPenaltyWinnerId]?.name || match.officialPenaltyWinnerId})`}
                  </div>
                  {(() => {
                    const result = calculateMatchPoints(match, pred);
                    return (
                      <span 
                        style={{ 
                          background: result.colorBg, 
                          color: result.colorText, 
                          borderColor: result.colorBorder,
                          border: '1px solid',
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '11px'
                        }}
                      >
                        {result.description}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {roundMatches.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          Nenhum jogo nesta rodada ainda.
        </div>
      )}
    </div>
  );
}
