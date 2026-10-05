/* ============================================================
   SEO RANKER — main.js
   Event handling (single delegated listener) and start-up.
   ============================================================ */
(function () {
  'use strict';
  const SR = window.SR;
  const U = SR.ui, E = SR.engine;

  const commit = () => { SR.save.write(U.gs); U.renderAll(); };
  const tone = t => (t === 'danger' ? 'danger' : t === 'warning' ? 'warning' : 'success');

  function enterGame(gs, message) {
    U.gs = gs;
    U.view = 'overview';
    U.showScreen('screen-game');
    U.renderAll();
    U.syncFlow();
    if (message) U.toast(message[0], message[1], message[2]);
  }

  /* After an action: celebrate achievements without blocking the month flow */
  function celebrate(res) {
    res.missions.forEach(m => U.toast('success', 'Mission complete', `${m.title}: +${SR.money(m.reward.budget)} budget`));
    if (res.achievements.length) {
      setTimeout(() => {
        if (U.gs && U.gs.flow.stage === 'play' && !U.topModal()) U.openAchievement(res.achievements[0]);
        else U.toast('success', 'Achievement unlocked', res.achievements[0].name);
      }, 450);
      res.achievements.slice(1).forEach(a => U.toast('success', 'Achievement unlocked', a.name));
    }
  }

  const focusSelected = () => { const b = document.querySelector('.opt-card.selected'); if (b) b.focus(); };
  const focusHeading = () => { const h = document.querySelector('#setup-root h1'); if (h) h.focus(); };
  const focusTab = () => { const t = document.querySelector('.tab.active'); if (t) t.focus(); };

  const ACTS = {
    /* --- start screen & setup --- */
    newGame() {
      if (SR.save.has()) U.openConfirm('confirmNew', 'Start a new campaign?', 'You already have a saved campaign. It will be replaced as soon as you begin the new one.', 'startSetup', 'Continue');
      else U.startSetup();
    },
    startSetup() { U.closeModal('confirmNew', true); U.startSetup(); },
    continueGame() {
      const gs = SR.save.read();
      if (!gs) { U.toast('warning', 'No saved game', 'Start a new game to begin.'); return; }
      enterGame(gs, ['success', 'Game loaded', `Continuing ${gs.websiteName}, Month ${gs.month} of ${SR.CONFIG.TOTAL_MONTHS}.`]);
    },
    howTo() { U.openHowTo(); },
    pickType(el) { U.setup.type = el.dataset.id; U.renderSetup(); focusSelected(); },
    pickDiff(el) { U.setup.diff = el.dataset.id; U.renderSetup(); focusSelected(); },
    setupNext() { U.setup.step += 1; U.renderSetup(); focusHeading(); },
    setupBack() {
      if (U.setup.step === 1) { U.showScreen('screen-start'); U.refreshStart(); return; }
      U.setup.step -= 1; U.renderSetup(); focusHeading();
    },
    startCampaign() {
      const gs = U.setup.pending;
      if (!gs) return;
      U.setup.pending = null;
      SR.save.write(gs);
      enterGame(gs, ['info', 'Campaign started', `Good luck with your ${gs.websiteName}.`]);
    },

    /* --- navigation --- */
    nav(el) { U.setView(el.dataset.view, true); },
    chartMetric(el) { U.chartMetric = el.dataset.metric; U.renderAll(); focusTab(); },
    kwTab(el) { U.kwTab = el.dataset.tab; U.renderAll(); focusTab(); },
    closeModal() { U.closeModal(); },

    /* --- actions --- */
    openAction(el) { U.openAction(el.dataset.id); },
    pickVariant(el) { U.pickVariant(el.dataset.v); },
    confirmAction() {
      const gs = U.gs, { id, variant } = U.previewState;
      const res = E.act(gs, id, variant);
      if (!res.ok) { U.toast('warning', 'Cannot execute', res.reason); return; }
      U.closeModal('action', true);
      U.toast(tone(res.entry.tone), res.entry.shortName, res.entry.summary);
      commit();
      celebrate(res);
      if (res.openGSC) U.openGSC();
    },

    /* --- month flow --- */
    endMonth() {
      const gs = U.gs;
      if (!gs || gs.phase !== 'playing' || gs.flow.stage !== 'play') return;
      if (gs.actionPoints > 0) {
        U.openConfirm('confirmEnd', `End Month ${gs.month}?`, `You still have ${gs.actionPoints} unused action point${gs.actionPoints > 1 ? 's' : ''}. Unused points do not carry over, and rivals keep moving.`, 'endMonthNow', 'End month anyway');
      } else ACTS.endMonthNow();
    },
    endMonthNow() {
      const gs = U.gs;
      U.closeModal('confirmEnd', true);
      if (!gs || gs.flow.stage !== 'play') return;
      E.endMonth(gs);
      commit();
      U.syncFlow();
    },
    afterEvent() { E.afterEvent(U.gs); commit(); U.syncFlow(); },
    decide(el) {
      const res = E.decide(U.gs, el.dataset.id);
      if (!res.ok) { U.toast('warning', 'Cannot choose', res.reason); return; }
      commit(); U.syncFlow();
    },
    afterDecision() { E.afterDecision(U.gs); commit(); U.syncFlow(); },
    afterReport() { E.afterReport(U.gs); commit(); U.syncFlow(); },
    startMonth() { E.dismissPlan(U.gs); commit(); U.syncFlow(); window.scrollTo(0, 0); },

    /* --- info screens --- */
    scoreBreakdown() { U.openBreakdown(); },
    saveGame() {
      if (SR.save.write(U.gs)) U.toast('success', 'Game saved', 'Your progress is stored in this browser.');
      else U.toast('danger', 'Could not save', 'Browser storage is unavailable.');
    },
    menu() { U.openMenu(); },
    goProgress() { U.closeModal('menu', true); U.setView('progress', true); },
    toTitle() { U.closeModal('menu', true); SR.save.write(U.gs); U.showScreen('screen-start'); U.refreshStart(); },
    confirmReset() {
      U.closeModal('menu', true);
      U.openConfirm('confirmReset', 'Reset game?', 'This permanently deletes your saved campaign. Your player profile and lifetime achievements are kept.', 'doReset', 'Yes, reset', true);
    },
    doReset() {
      SR.save.clear(); U.gs = null;
      ['confirmReset', 'final', 'menu'].forEach(id => U.closeModal(id, true));
      U.showScreen('screen-start'); U.refreshStart();
      U.toast('info', 'Game reset', 'Your campaign was deleted.');
    },
    showFinal() { U.openFinal(); },
    playAgain() { U.closeModal('final', true); U.startSetup(); },
    copyResult() {
      const ta = document.getElementById('share-text');
      if (!ta) return;
      const done = () => {
        U.toast('success', 'Copied', 'Your result is on the clipboard.');
        const b = document.getElementById('btn-copy');
        if (b) {
          b.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> COPIED';
          setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-copy" aria-hidden="true"></i> COPY RESULT'; }, 2000);
        }
      };
      const fallback = () => {
        ta.select();
        try { document.execCommand('copy'); done(); } catch (err) { U.toast('warning', 'Copy manually', 'Select the text and copy it.'); }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, fallback);
      else fallback();
    }
  };

  document.addEventListener('click', e => {
    const info = e.target.closest('.info');
    if (info) { e.preventDefault(); if (U.tipOwner() === info) U.hideTip(); else U.showTip(info); return; }
    if (!e.target.closest('#tooltip')) U.hideTip();

    const el = e.target.closest('[data-act]');
    if (el && !el.disabled && ACTS[el.dataset.act]) { e.preventDefault(); ACTS[el.dataset.act](el, e); return; }

    // Click on the dimmed backdrop closes dismissible modals
    const top = U.topModal();
    if (top && top.dismissible && e.target === top.el) U.closeModal();
  });

  const infoOf = e => (e.target.closest ? e.target.closest('.info') : null);
  document.addEventListener('mouseover', e => { const i = infoOf(e); if (i && U.tipOwner() !== i) U.showTip(i); });
  document.addEventListener('mouseout', e => { const i = infoOf(e); if (i && !i.matches(':focus')) U.hideTip(); });
  document.addEventListener('focusin', e => { const i = infoOf(e); if (i) U.showTip(i); });
  document.addEventListener('focusout', e => { const i = infoOf(e); if (i) U.hideTip(); });
  window.addEventListener('scroll', () => U.hideTip(), { passive: true });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (U.tipOwner()) { U.hideTip(); return; }
      const top = U.topModal();
      if (top && top.dismissible) U.closeModal();
    } else if (e.key === 'Tab') U.trapFocus(e);
  });

  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => U.gs && U.drawCharts(), 150); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && U.gs) SR.save.write(U.gs); });

  document.addEventListener('DOMContentLoaded', () => { U.refreshStart(); });

  SR.acts = ACTS; // exposed for debugging and tests
})();
