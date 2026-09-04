(() => {
  const snemFixture = {
    slug: 'snemm',
    company: 'SNEMM',
    title: 'Une vitrine plus lisible pour SNEMM.',
    description: 'Un aperçu dédié pour rendre votre mission, vos parcours et votre réseau plus immédiats.',
    siteLabel: 'ENTRAIDE · MÉMOIRE · HONNEUR',
    siteHeadline: 'Une présence qui rassemble.',
    observation: 'Les informations utiles doivent être comprises rapidement, y compris depuis un téléphone.',
    benefit: 'Une proposition plus claire pour présenter la mission, les parcours et les points de contact.',
    facts: ['La proposition reprend les éléments disponibles sur la mission, les parcours et le réseau.'],
    improvements: [
      'Rendre la mission compréhensible dès la première lecture.',
      'Faciliter la navigation depuis un téléphone.',
      'Rassembler les points de contact dans un parcours lisible.',
    ],
    logoUrl: null,
    contactName: null,
    contactEmail: null,
    prototypeUrl: 'https://snemm-2609319c.magicscript-demos-a185c139.pages.dev/',
    salesRoomStatus: 'ACTIVE',
  };
  const disabledSnemFixture = { ...snemFixture, salesRoomStatus: 'DISABLED' };
  const personalizedFixtures = {
    'fixture-snemm-v2': snemFixture,
    snemm: snemFixture,
    'fixture-snemm-disabled': disabledSnemFixture,
  };

  const routeSegments = window.location.pathname.split('/').filter(Boolean);
  let fixtureKey = null;
  let invalidRoute = false;
  try {
    fixtureKey = (routeSegments[0] === 'p' || routeSegments[0] === 'demo' || routeSegments[0] === 'prototype') && routeSegments[1]
      ? decodeURIComponent(routeSegments[1])
      : null;
  } catch {
    fixtureKey = null;
    invalidRoute = true;
  }
  const routeKind = routeSegments[0];
  const surfaceKind = routeKind === 'p'
    ? 'PROSPECT_SALES_ROOM'
    : routeKind === 'demo' || routeKind === 'prototype'
      ? 'PROSPECT_PROTOTYPE'
      : routeSegments.length === 0
        ? 'PUBLIC_BRAND_SITE'
        : 'PUBLIC_BRAND_SITE';
  const fixture = fixtureKey ? personalizedFixtures[fixtureKey] : null;
  const salesRoomUrl = (fixture) => `/p/${encodeURIComponent(fixture.slug)}`;
  const prototypeEntryUrl = (fixture) => `/demo/${encodeURIComponent(fixture.slug)}`;

  const recordLocalEngagement = (type, details = {}) => {
    const event = {
      type,
      surface: surfaceKind,
      slug: fixture?.slug ?? fixtureKey ?? null,
      occurredAt: new Date().toISOString(),
      ...details,
    };
    try {
      const key = 'magic-script:engagement-events';
      const previous = JSON.parse(window.localStorage.getItem(key) || '[]');
      const events = Array.isArray(previous) ? previous : [];
      window.localStorage.setItem(key, JSON.stringify([...events.slice(-49), event]));
    } catch {
      // Local preview remains usable when storage is unavailable.
    }
    const sink = window.__MAGICSCRIPT_EVENT_SINK__;
    if (typeof sink === 'function') {
      try { sink(event); } catch { /* optional local replay sink */ }
    }
    return event;
  };

  const showUnavailable = (reason) => {
    document.body.classList.add('surface-unavailable');
    const unavailable = document.querySelector('[data-surface-unavailable]');
    if (unavailable) unavailable.hidden = false;
    recordLocalEngagement('SALES_ROOM_RESOLUTION_FAILED', { reason });
    void postConfiguredSalesRoomEvent('SALES_ROOM_RESOLUTION_FAILED', { reason });
  };

  const fillPrototypeSurface = (currentFixture) => {
    document.body.classList.add('surface-prototype');
    const defaultStage = document.querySelector('[data-stage-default]');
    const personalizedStage = document.querySelector('[data-personalized-preview]');
    if (!defaultStage || !personalizedStage) return;
    const textBindings = {
      '[data-preview-company]': currentFixture.company,
      '[data-preview-title]': currentFixture.title,
      '[data-preview-description]': currentFixture.description,
      '[data-preview-site-name]': currentFixture.company,
      '[data-preview-site-label]': currentFixture.siteLabel,
      '[data-preview-site-headline]': currentFixture.siteHeadline,
    };
    Object.entries(textBindings).forEach(([selector, value]) => {
      const node = personalizedStage.querySelector(selector);
      if (node) node.textContent = value;
    });
    const prototypeLink = personalizedStage.querySelector('[data-prototype-link]');
    if (prototypeLink) {
      prototypeLink.href = salesRoomUrl(currentFixture);
      prototypeLink.removeAttribute('target');
      prototypeLink.textContent = 'Voir votre proposition';
    }
    defaultStage.hidden = true;
    personalizedStage.hidden = false;
  };

  const setSurfaceStatus = (node, message, state = '') => {
    if (!node) return;
    node.hidden = !message;
    node.textContent = message;
    node.dataset.state = state;
  };

  const formatEuro = (cents) => new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(cents) / 100);

  const formatQuoteDate = (value) => {
    const date = new Date(`${value}T12:00:00.000Z`);
    if (!Number.isFinite(date.getTime())) return String(value || '');
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  };

  const postSalesRoomAction = async (path, payload) => {
    const configuredBase = typeof window.__MAGICSCRIPT_SALES_ROOM_API_BASE__ === 'string'
      ? window.__MAGICSCRIPT_SALES_ROOM_API_BASE__.replace(/\/$/, '')
      : '';
    if (!configuredBase) return { mode: 'disabled', result: {} };
    const response = await fetch(`${configuredBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 503) return { mode: 'disabled', result };
    if (!response.ok || result?.ok !== true) throw new Error('sales_room_action_failed');
    return { mode: 'remote', result };
  };

  const getSalesRoomAction = async (path) => {
    const configuredBase = typeof window.__MAGICSCRIPT_SALES_ROOM_API_BASE__ === 'string'
      ? window.__MAGICSCRIPT_SALES_ROOM_API_BASE__.replace(/\/$/, '')
      : '';
    if (!configuredBase) return { mode: 'disabled', result: {} };
    const response = await fetch(`${configuredBase}${path}`, {
      headers: { Accept: 'application/json' },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.ok !== true) throw new Error('sales_room_read_failed');
    return { mode: 'remote', result };
  };

  const localIdempotencyKey = (prefix) => {
    if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  const postConfiguredSalesRoomEvent = async (type, details = {}) => {
    const configuredBase = typeof window.__MAGICSCRIPT_SALES_ROOM_API_BASE__ === 'string'
      ? window.__MAGICSCRIPT_SALES_ROOM_API_BASE__.replace(/\/$/, '')
      : '';
    const slug = fixture?.slug ?? fixtureKey;
    if (!configuredBase || !slug || !/^[a-z0-9]+(?:-[a-z0-9]+){0,15}$/i.test(slug)) return null;
    try {
      return await postSalesRoomAction('/api/public/sales-room-event', {
        type,
        slug,
        idempotencyKey: localIdempotencyKey(`sales-room-${type.toLowerCase()}`),
        ...details,
      });
    } catch {
      return null;
    }
  };

  const fillSalesRoomSurface = (currentFixture) => {
    if (currentFixture.salesRoomStatus !== 'ACTIVE') {
      showUnavailable('DISABLED');
      return;
    }
    document.body.classList.add('surface-sales-room');
    const salesRoom = document.querySelector('[data-sales-room]');
    if (!salesRoom) return;
    salesRoom.hidden = false;
    const bindings = {
      '[data-room-company]': currentFixture.company,
      '[data-room-title]': currentFixture.title,
      '[data-room-summary]': currentFixture.description,
      '[data-room-site-label]': currentFixture.siteLabel,
      '[data-room-site-headline]': currentFixture.siteHeadline,
    };
    Object.entries(bindings).forEach(([selector, value]) => {
      const node = salesRoom.querySelector(selector);
      if (node) node.textContent = value;
    });
    const logo = salesRoom.querySelector('[data-room-logo]');
    if (logo && currentFixture.logoUrl) {
      logo.src = currentFixture.logoUrl;
      logo.alt = `Logo ${currentFixture.company}`;
      logo.hidden = false;
    }

    const renderCards = (selector, items, label) => {
      const container = salesRoom.querySelector(selector);
      if (!container) return;
      container.replaceChildren();
      const safeItems = Array.isArray(items)
        ? items.filter((item) => typeof item === 'string' && item.trim()).slice(0, 4)
        : [];
      safeItems.forEach((item) => {
        const card = document.createElement('article');
        card.className = 'surface-card';
        const cardLabel = document.createElement('span');
        cardLabel.className = 'surface-card-label';
        cardLabel.textContent = label;
        const text = document.createElement('p');
        text.textContent = item.trim();
        card.append(cardLabel, text);
        container.append(card);
      });
      container.hidden = safeItems.length === 0;
    };
    renderCards('[data-room-facts]', currentFixture.facts, 'Constat vérifié');
    renderCards('[data-room-improvements]', currentFixture.improvements, 'Amélioration proposée');

    const prototypeLink = salesRoom.querySelector('[data-room-prototype]');
    const prototypeStatus = salesRoom.querySelector('[data-room-prototype-status]');
    const prototypePreview = salesRoom.querySelector('[data-room-preview]');
    const hasPrototype = Boolean(currentFixture.slug && currentFixture.prototypeUrl);
    if (prototypeLink && hasPrototype) {
      prototypeLink.href = prototypeEntryUrl(currentFixture);
      prototypeLink.removeAttribute('target');
      prototypeLink.removeAttribute('aria-disabled');
    } else {
      prototypeLink?.removeAttribute('href');
      prototypeLink?.setAttribute('aria-disabled', 'true');
      if (prototypeLink) prototypeLink.hidden = true;
      if (prototypePreview) prototypePreview.hidden = true;
      setSurfaceStatus(prototypeStatus, 'Aucun prototype validé n’est actuellement disponible.', 'neutral');
    }
    recordLocalEngagement('SALES_ROOM_ACCESSED');
    void postConfiguredSalesRoomEvent('SALES_ROOM_ACCESSED');

    const shareToggle = salesRoom.querySelector('[data-share-toggle]');
    const shareOptions = salesRoom.querySelector('[data-share-options]');
    const shareStatus = salesRoom.querySelector('[data-share-status]');
    shareToggle?.addEventListener('click', () => {
      const open = shareToggle.getAttribute('aria-expanded') === 'true';
      shareToggle.setAttribute('aria-expanded', String(!open));
      if (shareOptions) shareOptions.hidden = open;
    });
    salesRoom.querySelectorAll('[data-share-channel]').forEach((button) => {
      button.addEventListener('click', async () => {
        const channel = button.getAttribute('data-share-channel') || 'unknown';
        const url = new URL(salesRoomUrl(currentFixture), window.location.origin).toString();
        const shareText = `${currentFixture.company} — ${currentFixture.title} ${url}`;
        recordLocalEngagement('SHARE_CLICKED', { channel });
        void postConfiguredSalesRoomEvent('SHARE_CLICKED', { channel });
        if (channel === 'system' && typeof navigator.share === 'function') {
          try {
            await navigator.share({ title: currentFixture.title, text: shareText, url });
            if (shareStatus) shareStatus.textContent = 'Le partage système a été ouvert. La réception ou la lecture ne sont pas suivies.';
          } catch {
            if (shareStatus) shareStatus.textContent = 'Le partage a été annulé. Aucun destinataire n’est déduit.';
          }
          return;
        }
        if (channel === 'system' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url).catch(() => {});
          if (shareStatus) shareStatus.textContent = 'Lien copié. La réception ou la lecture ne sont pas suivies.';
          return;
        }
        if (channel === 'whatsapp') {
          window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
        } else if (channel === 'email') {
          window.location.href = `mailto:?subject=${encodeURIComponent(currentFixture.title)}&body=${encodeURIComponent(shareText)}`;
        }
        if (shareStatus) shareStatus.textContent = 'Le canal de partage a été ouvert. La réception ou la lecture ne sont pas suivies.';
      });
    });

    const messageForm = salesRoom.querySelector('[data-sales-room-message-form]');
    const messageStatus = salesRoom.querySelector('[data-message-status]');
    const messageSubmit = messageForm?.querySelector('button[type="submit"]');
    const meetingButton = salesRoom.querySelector('[data-room-meeting]');
    const meetingStatus = salesRoom.querySelector('[data-meeting-status]');
    const communicationPanel = salesRoom.querySelector('[data-communication-panel]');
    const bookingPanel = salesRoom.querySelector('[data-booking-panel]');
    const bookingSlots = salesRoom.querySelector('[data-booking-slots]');
    const bookingStatus = salesRoom.querySelector('[data-booking-status]');
    const bookingManage = salesRoom.querySelector('[data-booking-manage]');
    const bookingCancel = salesRoom.querySelector('[data-booking-cancel]');
    const bookingName = salesRoom.querySelector('[data-booking-name]');
    const bookingPhone = salesRoom.querySelector('[data-booking-phone]');
    const messageLink = salesRoom.querySelector('[data-room-message-link]');
    const communicationModeInput = messageForm?.querySelector('[name="communicationMode"]');
    const quoteSection = salesRoom.querySelector('[data-room-quote]');
    const quoteLoading = salesRoom.querySelector('[data-quote-loading]');
    const quoteContent = salesRoom.querySelector('[data-quote-content]');
    const quoteAcceptanceForm = salesRoom.querySelector('[data-quote-acceptance-form]');
    const quoteAcceptanceStatus = salesRoom.querySelector('[data-quote-acceptance-status]');
    const quoteAcceptanceSubmit = quoteAcceptanceForm?.querySelector('button[type="submit"]');
    const quoteAcceptanceIdempotencyKey = localIdempotencyKey('quote-acceptance');
    const prospectTimezone = typeof window.__MAGICSCRIPT_PROSPECT_TIMEZONE__ === 'string'
      ? window.__MAGICSCRIPT_PROSPECT_TIMEZONE__
      : 'America/Martinique';
    let bookedMeetingId = null;

    const setQuoteText = (selector, value) => {
      const node = salesRoom.querySelector(selector);
      if (node) node.textContent = String(value);
    };

    const showAcceptedQuote = (acceptance) => {
      if (quoteAcceptanceForm) quoteAcceptanceForm.hidden = true;
      const acceptedAt = acceptance?.acceptedAt
        ? new Intl.DateTimeFormat('fr-FR', {
            dateStyle: 'long',
            timeStyle: 'short',
          }).format(new Date(acceptance.acceptedAt))
        : null;
      setSurfaceStatus(
        quoteAcceptanceStatus,
        acceptedAt
          ? `Bon pour accord enregistré le ${acceptedAt}.`
          : 'Bon pour accord enregistré.',
        'success',
      );
    };

    const renderQuote = (result) => {
      const quote = result?.quote;
      const line = quote?.line;
      const valid =
        quote &&
        quote.currency === 'EUR' &&
        quote.depositPercent === 50 &&
        quote.balancePercent === 50 &&
        Number.isInteger(quote.totalCents) &&
        quote.totalCents > 0 &&
        line &&
        typeof line.description === 'string' &&
        line.description.trim();
      if (!valid) throw new Error('sales_room_quote_invalid');

      const depositCents = Math.round(quote.totalCents * quote.depositPercent / 100);
      const balanceCents = quote.totalCents - depositCents;
      setQuoteText('[data-quote-number]', quote.quoteNumber);
      setQuoteText('[data-quote-description]', line.description);
      setQuoteText('[data-quote-total]', formatEuro(quote.totalCents));
      setQuoteText('[data-quote-deposit-percent]', `${quote.depositPercent} %`);
      setQuoteText('[data-quote-deposit]', formatEuro(depositCents));
      setQuoteText('[data-quote-balance-percent]', `${quote.balancePercent} %`);
      setQuoteText('[data-quote-balance]', formatEuro(balanceCents));
      setQuoteText('[data-quote-valid-until]', formatQuoteDate(quote.validUntil));
      setQuoteText('[data-quote-delivery]', formatQuoteDate(quote.deliveryDeadline));
      setQuoteText('[data-quote-vat-note]', quote.vatNote);
      setQuoteText('[data-quote-cgv-reference]', ` · ${quote.cgvReference}`);

      if (quoteSection) quoteSection.hidden = false;
      if (quoteContent) quoteContent.hidden = false;
      setSurfaceStatus(quoteLoading, '', '');

      const signerName = quoteAcceptanceForm?.querySelector('[name="signerName"]');
      const signerEmail = quoteAcceptanceForm?.querySelector('[name="signerEmail"]');
      const signerCompany = quoteAcceptanceForm?.querySelector('[name="signerCompanyName"]');
      if (signerName instanceof HTMLInputElement && currentFixture.contactName) {
        signerName.value = currentFixture.contactName;
      }
      if (signerEmail instanceof HTMLInputElement && currentFixture.contactEmail) {
        signerEmail.value = currentFixture.contactEmail;
      }
      if (signerCompany instanceof HTMLInputElement) {
        signerCompany.value = quote.client?.companyName || currentFixture.company;
      }

      if (result.accepted === true) showAcceptedQuote(result.acceptance);
    };

    const loadQuote = async () => {
      const query = new URLSearchParams({ slug: currentFixture.slug });
      try {
        const outcome = await getSalesRoomAction(`/api/public/sales-room-quote?${query.toString()}`);
        if (outcome.mode === 'disabled' || !outcome.result.quote) return;
        renderQuote(outcome.result);
      } catch {
        if (quoteSection) quoteSection.hidden = false;
        setSurfaceStatus(
          quoteLoading,
          'Le devis validé n’est pas disponible actuellement.',
          'error',
        );
      }
    };

    const showMessageForm = (visible) => {
      if (messageForm) messageForm.hidden = !visible;
    };

    const renderBookingSlots = (slots) => {
      if (!bookingSlots) return;
      bookingSlots.replaceChildren();
      if (!slots.length) {
        setSurfaceStatus(bookingStatus, 'Aucun créneau disponible pour le moment.', 'neutral');
        return;
      }
      slots.forEach((slot) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'booking-slot';
        button.dataset.startAtUtc = slot.startAtUtc;
        const prospectTime = document.createElement('strong');
        prospectTime.textContent = slot.prospectLabel;
        const parisTime = document.createElement('small');
        parisTime.textContent = `Stéphane : ${slot.parisLabel}`;
        button.append(prospectTime, parisTime);
        button.addEventListener('click', () => {
          bookingSlots.querySelectorAll('.booking-slot').forEach((candidate) => candidate.removeAttribute('aria-current'));
          button.setAttribute('aria-current', 'true');
          setSurfaceStatus(bookingStatus, 'Créneau sélectionné. Confirmez avec votre téléphone.', 'pending');
          void confirmBooking(slot);
        });
        bookingSlots.append(button);
      });
      setSurfaceStatus(bookingStatus, 'Sélectionnez un créneau pour confirmer.', 'neutral');
    };

    const loadAvailability = async () => {
      if (!bookingSlots) return;
      bookingSlots.replaceChildren();
      setSurfaceStatus(bookingStatus, 'Recherche des créneaux disponibles…', 'pending');
      const query = new URLSearchParams({
        slug: currentFixture.slug,
        timeZone: prospectTimezone,
        days: '14',
      });
      try {
        const outcome = await getSalesRoomAction(`/api/public/sales-room-availability?${query.toString()}`);
        if (outcome.mode === 'disabled') {
          setSurfaceStatus(bookingStatus, 'Les créneaux seront disponibles après configuration de la réception. Aucun rendez-vous n’est simulé sur cet aperçu.', 'neutral');
          return;
        }
        renderBookingSlots(Array.isArray(outcome.result.slots) ? outcome.result.slots : []);
      } catch {
        setSurfaceStatus(bookingStatus, 'Les créneaux ne sont pas disponibles actuellement. Aucun rendez-vous n’a été réservé.', 'error');
      }
    };

    const confirmBooking = async (slot) => {
      if (!bookingPhone || !(bookingPhone instanceof HTMLInputElement)) return;
      const phone = bookingPhone.value.trim();
      if (!phone || !/^[0-9+().\s-]{6,40}$/.test(phone)) {
        setSurfaceStatus(bookingStatus, 'Indiquez un numéro de téléphone valide.', 'error');
        bookingPhone.focus();
        return;
      }
      const payload = {
        slug: currentFixture.slug,
        communicationMode: 'phone',
        startAtUtc: slot.startAtUtc,
        prospectTimezone,
        phone,
        name: bookingName instanceof HTMLInputElement ? bookingName.value.trim() : '',
        idempotencyKey: localIdempotencyKey('meeting-booking'),
        ...(bookedMeetingId ? { rescheduledFromMeetingId: bookedMeetingId } : {}),
      };
      setSurfaceStatus(bookingStatus, 'Confirmation du créneau…', 'pending');
      bookingSlots?.querySelectorAll('button').forEach((candidate) => {
        if (candidate instanceof HTMLButtonElement) candidate.disabled = true;
      });
      try {
        const outcome = await postSalesRoomAction('/api/public/sales-room-booking', payload);
        if (outcome.mode === 'disabled') {
          setSurfaceStatus(bookingStatus, 'La réception n’est pas activée sur cet aperçu. Aucun rendez-vous n’est simulé.', 'neutral');
          return;
        }
        const meeting = outcome.result.meeting;
        bookedMeetingId = meeting?.meetingId || bookedMeetingId;
        setSurfaceStatus(meetingStatus, 'Votre rendez-vous est confirmé.', 'success');
        setSurfaceStatus(bookingStatus, `Rendez-vous confirmé · ${meeting?.prospectTime || slot.prospectLabel}`, 'success');
        if (bookingManage) bookingManage.hidden = false;
        recordLocalEngagement('MEETING_BOOKED', { persisted: true });
        await loadAvailability();
        setSurfaceStatus(bookingStatus, `Rendez-vous confirmé · ${meeting?.prospectTime || slot.prospectLabel}`, 'success');
      } catch (error) {
        if (String(error?.message || '').includes('sales_room_action_failed')) {
          setSurfaceStatus(bookingStatus, 'Ce créneau vient peut-être d’être pris. Choisissez-en un autre.', 'error');
          await loadAvailability();
        } else {
          setSurfaceStatus(bookingStatus, 'La réservation n’a pas pu être confirmée. Aucun rendez-vous n’a été créé.', 'error');
        }
      } finally {
        bookingSlots?.querySelectorAll('button').forEach((candidate) => {
          if (candidate instanceof HTMLButtonElement) candidate.disabled = false;
        });
      }
    };

    const activateCommunicationMode = (mode) => {
      if (communicationModeInput instanceof HTMLInputElement) communicationModeInput.value = mode === 'email' ? 'email' : '';
      if (mode === 'email') {
        showMessageForm(true);
        if (bookingPanel) bookingPanel.hidden = true;
        setSurfaceStatus(meetingStatus, 'Écrivez votre message ; Stéphane vous répondra humainement.', 'success');
        messageForm?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        showMessageForm(false);
        if (bookingPanel) bookingPanel.hidden = false;
        setSurfaceStatus(meetingStatus, 'Choisissez un créneau de 30 minutes.', 'pending');
        void loadAvailability();
        bookingPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    meetingButton?.addEventListener('click', () => {
      if (meetingButton instanceof HTMLButtonElement && meetingButton.disabled) return;
      if (communicationPanel) communicationPanel.hidden = false;
      setSurfaceStatus(meetingStatus, 'Choisissez comment vous souhaitez poursuivre.', 'neutral');
      communicationPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    communicationPanel?.querySelectorAll('[data-communication-mode]').forEach((button) => {
      button.addEventListener('click', () => activateCommunicationMode(button.getAttribute('data-communication-mode')));
    });
    messageLink?.addEventListener('click', () => {
      activateCommunicationMode('email');
    });

    bookingCancel?.addEventListener('click', async () => {
      if (!bookedMeetingId || !(bookingCancel instanceof HTMLButtonElement) || bookingCancel.disabled) return;
      bookingCancel.disabled = true;
      try {
        const outcome = await postSalesRoomAction('/api/public/sales-room-meeting-cancel', {
          slug: currentFixture.slug,
          meetingId: bookedMeetingId,
          idempotencyKey: localIdempotencyKey('meeting-cancel'),
        });
        if (outcome.mode === 'remote') {
          bookedMeetingId = null;
          if (bookingManage) bookingManage.hidden = true;
          setSurfaceStatus(bookingStatus, 'Rendez-vous annulé. Le créneau est à nouveau disponible.', 'success');
          await loadAvailability();
        } else {
          setSurfaceStatus(bookingStatus, 'La réception n’est pas activée sur cet aperçu. Aucun rendez-vous n’a été annulé.', 'neutral');
        }
      } catch {
        setSurfaceStatus(bookingStatus, 'L’annulation n’a pas pu être confirmée.', 'error');
      } finally {
        bookingCancel.disabled = false;
      }
    });

    quoteAcceptanceForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (
        !(event.currentTarget instanceof HTMLFormElement) ||
        !(quoteAcceptanceSubmit instanceof HTMLButtonElement) ||
        quoteAcceptanceSubmit.disabled
      ) {
        return;
      }

      const formData = new FormData(event.currentTarget);
      const signerName = String(formData.get('signerName') || '').trim();
      const signerEmail = String(formData.get('signerEmail') || '').trim();
      const signerCompanyName = String(formData.get('signerCompanyName') || '').trim();
      const consentGiven = formData.get('consentGiven') === 'on';

      if (
        !signerName ||
        signerName.length > 160 ||
        !signerEmail ||
        signerEmail.length > 320 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail) ||
        !signerCompanyName ||
        signerCompanyName.length > 240 ||
        !consentGiven
      ) {
        setSurfaceStatus(
          quoteAcceptanceStatus,
          'Complétez les trois champs et cochez le Bon pour accord.',
          'error',
        );
        return;
      }

      quoteAcceptanceSubmit.disabled = true;
      setSurfaceStatus(
        quoteAcceptanceStatus,
        'Enregistrement du Bon pour accord…',
        'pending',
      );

      try {
        const outcome = await postSalesRoomAction(
          '/api/public/sales-room-quote-accept',
          {
            slug: currentFixture.slug,
            idempotencyKey: quoteAcceptanceIdempotencyKey,
            signerName,
            signerEmail,
            signerCompanyName,
            consentGiven: true,
          },
        );
        if (outcome.mode === 'disabled') {
          setSurfaceStatus(
            quoteAcceptanceStatus,
            'La validation n’est pas activée sur cet aperçu. Aucun accord n’a été enregistré.',
            'neutral',
          );
          return;
        }
        recordLocalEngagement('QUOTE_ACCEPTED', { persisted: true });
        showAcceptedQuote({ acceptedAt: new Date().toISOString() });
      } catch {
        setSurfaceStatus(
          quoteAcceptanceStatus,
          'Le Bon pour accord n’a pas pu être enregistré. Aucun paiement n’a été déclenché.',
          'error',
        );
      } finally {
        quoteAcceptanceSubmit.disabled = false;
      }
    });

    messageForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!(event.currentTarget instanceof HTMLFormElement) || !(messageSubmit instanceof HTMLButtonElement)) return;
      if (messageSubmit.disabled) return;
      const formData = new FormData(event.currentTarget);
      const message = String(formData.get('message') || '').trim();
      const email = String(formData.get('email') || '').trim();
      const communicationMode = String(formData.get('communicationMode') || '').trim();
      if (!message) {
        setSurfaceStatus(messageStatus, 'Le message est obligatoire.', 'error');
        return;
      }
      if ((communicationMode === 'email' && !email) || message.length > 4000 || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        if (communicationMode === 'email' && !email) {
          setSurfaceStatus(messageStatus, 'Un email est nécessaire pour continuer par écrit.', 'error');
          return;
        }
        setSurfaceStatus(messageStatus, 'Vérifie le message et l’adresse email indiquée.', 'error');
        return;
      }

      messageSubmit.disabled = true;
      setSurfaceStatus(messageStatus, 'Préparation du message…', 'pending');
      const payload = {
        slug: currentFixture.slug,
        idempotencyKey: localIdempotencyKey('sales-room-message'),
        name: String(formData.get('name') || '').trim(),
        email,
        message,
        ...(communicationMode === 'email' ? { communicationMode } : {}),
      };
      try {
        const outcome = await postSalesRoomAction('/api/public/sales-room-message', payload);
        if (outcome.mode === 'remote') {
          recordLocalEngagement('MESSAGE_SUBMITTED', { persisted: true });
          event.currentTarget.reset();
          setSurfaceStatus(messageStatus, 'Message enregistré pour Stéphane. Aucune réponse automatique n’a été envoyée.', 'success');
        } else {
          recordLocalEngagement('MESSAGE_SUBMITTED', { persisted: false, mode: 'preview' });
          setSurfaceStatus(messageStatus, 'La réception n’est pas activée sur cet aperçu. Aucun message externe n’a été envoyé.', 'neutral');
        }
      } catch {
        setSurfaceStatus(messageStatus, 'Le message n’a pas pu être préparé. Aucun envoi externe n’a été effectué.', 'error');
      } finally {
        messageSubmit.disabled = false;
      }
    });

    const messageName = salesRoom.querySelector('[name="name"]');
    const messageEmail = salesRoom.querySelector('[name="email"]');
    if (messageName && currentFixture.contactName) messageName.value = currentFixture.contactName;
    if (messageEmail && currentFixture.contactEmail) messageEmail.value = currentFixture.contactEmail;
    void loadQuote();
  };

  if (surfaceKind === 'PROSPECT_PROTOTYPE') {
    if (invalidRoute || !fixture) showUnavailable('UNKNOWN_SLUG');
    else fillPrototypeSurface(fixture);
  } else if (surfaceKind === 'PROSPECT_SALES_ROOM') {
    if (invalidRoute || !fixture) showUnavailable(invalidRoute ? 'INVALID_ROUTE' : 'UNKNOWN_SLUG');
    else fillSalesRoomSurface(fixture);
  }

  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#main-nav');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const syncHeader = () => header?.classList.toggle('scrolled', window.scrollY > 14);
  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });

  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    header?.classList.toggle('menu-open', !open);
  });

  nav?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuButton?.setAttribute('aria-expanded', 'false');
      header?.classList.remove('menu-open');
    });
  });

  const contactForm = document.querySelector('[data-contact-form]');
  const contactStatus = document.querySelector('[data-contact-status]');
  const contactSubmit = contactForm?.querySelector('button[type="submit"]');
  const setContactStatus = (message, state) => {
    if (!contactStatus) return;
    contactStatus.hidden = !message;
    contactStatus.textContent = message;
    contactStatus.dataset.state = state;
  };

  contactForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!(event.currentTarget instanceof HTMLFormElement)) return;
    contactSubmit?.setAttribute('disabled', 'disabled');
    setContactStatus('Transmission en cours…', 'pending');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 404 || result.error === 'email_not_configured') {
          throw new Error('contact_not_configured');
        }
        throw new Error('contact_failed');
      }
      event.currentTarget.reset();
      setContactStatus('Demande transmise. Magic Script reviendra vers toi à l’adresse indiquée.', 'success');
    } catch (error) {
      const message = error instanceof Error && error.message === 'contact_not_configured'
        ? 'Le formulaire est prêt ; la réception professionnelle sera activée lors de la configuration finale.'
        : 'Le service de contact est momentanément indisponible. Réessaie dans quelques instants.';
      setContactStatus(message, 'error');
    } finally {
      contactSubmit?.removeAttribute('disabled');
    }
  });

  const reveals = document.querySelectorAll('.reveal');
  const statNodes = document.querySelectorAll('[data-stat-value]');
  const renderStat = (node, value) => {
    node.textContent = `${Math.round(value)} %`;
  };
  const animateStat = (node) => {
    const target = Number(node.dataset.statValue);
    if (!Number.isFinite(target)) return;
    if (reducedMotion) {
      renderStat(node, target);
      return;
    }
    const startedAt = performance.now();
    const duration = 900;
    const tick = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - ((1 - progress) ** 3);
      renderStat(node, target * eased);
      if (progress < 1) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  };
  if (reducedMotion || !('IntersectionObserver' in window)) {
    statNodes.forEach((node) => animateStat(node));
  } else {
    const statObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateStat(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.8 });
    statNodes.forEach((node) => statObserver.observe(node));
  }

  if (reducedMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((node) => node.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    reveals.forEach((node) => observer.observe(node));
  }

  if (!reducedMotion && window.matchMedia('(pointer:fine)').matches) {
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        const rx = (0.5 - y) * 4;
        const ry = (x - 0.5) * 5;
        card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
        card.style.setProperty('--mx', `${x * 100}%`);
        card.style.setProperty('--my', `${y * 100}%`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    });

    document.querySelectorAll('[data-flashlight]').forEach((panel) => {
      panel.addEventListener('pointermove', (event) => {
        const rect = panel.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        panel.style.setProperty('--mx', `${x}%`);
        panel.style.setProperty('--my', `${y}%`);
      });
      panel.addEventListener('pointerleave', () => {
        panel.style.removeProperty('--mx');
        panel.style.removeProperty('--my');
      });
    });
  }
})();
