(() => {
  const audio = document.getElementById('chapter-audio');
  const playButton = document.getElementById('play-button');
  const muteButton = document.getElementById('mute-button');
  const volumeControl = document.getElementById('volume-control');
  const audioCaption = document.getElementById('audio-caption');
  const progressFill = document.getElementById('progress-fill');
  const progressLabel = document.getElementById('progress-label');
  const progressTrack = document.querySelector('.progress-track');
  const chapters = [...document.querySelectorAll('.chapter')];
  const chapterLinks = [...document.querySelectorAll('[data-chapter-link]')];
  const sceneButtons = [...document.querySelectorAll('.artwork-button[data-gallery="scenes"]')];
  const referenceButtons = [...document.querySelectorAll('.artwork-button[data-gallery="references"]')];
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightbox-image');
  const lightboxTitle = document.getElementById('lightbox-title');
  const closeButton = document.getElementById('close-lightbox');
  const previousButton = document.getElementById('previous-image');
  const nextButton = document.getElementById('next-image');
  let activeChapter = 1;
  let playingByChoice = false;
  let isMuted = false;
  let baseVolume = Number(volumeControl.value);
  let currentGallery = [];
  let currentImageIndex = 0;
  let returnFocus = null;
  let fadeTimer = 0;
  let fadeGeneration = 0;
  let cancelFade = null;

  function chapterLabel(number) {
    const roman = ['I','II','III','IV','V','VI','VII','VIII','IX'][number - 1] || String(number);
    return 'Bölüm ' + roman + ' · Sahne ' + number;
  }
  function updateAudioCaption() { audioCaption.textContent = chapterLabel(activeChapter); }
  function fadeTo(target, duration) {
    const generation = ++fadeGeneration;
    if (fadeTimer) clearInterval(fadeTimer);
    if (cancelFade) cancelFade(false);
    const from = audio.volume;
    const started = performance.now();
    return new Promise(resolve => {
      cancelFade = resolve;
      fadeTimer = setInterval(() => {
        if (generation !== fadeGeneration) return;
        const now = performance.now();
        const part = Math.min(1, (now - started) / duration);
        const eased = part * part * (3 - 2 * part);
        audio.volume = from + (target - from) * eased;
        if (part >= 1) {
          clearInterval(fadeTimer);
          fadeTimer = 0;
          cancelFade = null;
          resolve(true);
        }
      }, 24);
    });
  }
  async function playCurrentTrack() {
    const target = 'assets/audio/chapter-' + String(activeChapter).padStart(2, '0') + '.mp3';
    const requestedChapter = activeChapter;
    const alreadyLoaded = audio.getAttribute('src') === target;
    if (!alreadyLoaded) {
      if (audio.src) {
        const faded = await fadeTo(0, 360);
        if (!faded || requestedChapter !== activeChapter) return;
      }
      audio.pause();
      audio.src = target;
      audio.load();
    }
    audio.volume = isMuted ? 0 : Math.min(baseVolume, alreadyLoaded ? baseVolume : 0.08);
    let playRequest;
    try {
      playRequest = audio.play();
    } catch {
      if (requestedChapter === activeChapter) {
        playingByChoice = false;
        playButton.innerHTML = '▶ <span>Oynat</span>';
        playButton.setAttribute('aria-label', 'Müziği oynat');
      }
      return;
    }
    playingByChoice = true;
    playButton.innerHTML = 'Ⅱ <span>Duraklat</span>';
    playButton.setAttribute('aria-label', 'Müziği duraklat');
    fadeTo(isMuted ? 0 : baseVolume, alreadyLoaded ? 180 : 500);
    Promise.resolve(playRequest).catch(() => {
      if (requestedChapter === activeChapter && audio.getAttribute('src') === target) {
        playingByChoice = false;
        playButton.innerHTML = '▶ <span>Oynat</span>';
        playButton.setAttribute('aria-label', 'Müziği oynat');
      }
    });
  }
  playButton.addEventListener('click', () => {
    if (playingByChoice && !audio.paused) {
      playingByChoice = false;
      fadeTo(0, 180).then(completed => { if (completed && !playingByChoice) audio.pause(); });
      playButton.innerHTML = '▶ <span>Oynat</span>';
      playButton.setAttribute('aria-label', 'Müziği oynat');
    } else {
      playCurrentTrack();
    }
  });
  muteButton.addEventListener('click', () => {
    isMuted = !isMuted;
    muteButton.setAttribute('aria-pressed', String(isMuted));
    muteButton.setAttribute('aria-label', isMuted ? 'Sesi aç' : 'Sesi kapat');
    muteButton.textContent = isMuted ? '◌' : '◖';
    fadeTo(isMuted ? 0 : (playingByChoice ? baseVolume : 0), 180);
  });
  volumeControl.addEventListener('input', () => {
    baseVolume = Number(volumeControl.value);
    if (!isMuted && playingByChoice) audio.volume = baseVolume;
  });

  function setActiveChapter(number) {
    if (!number) return;
    const changed = number !== activeChapter;
    activeChapter = number;
    updateAudioCaption();
    chapterLinks.forEach(link => {
      if (Number(link.dataset.chapterLink) === number) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    if (changed && playingByChoice && !audio.paused) playCurrentTrack();
  }
  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const percent = max > 0 ? Math.min(100, Math.max(0, Math.round(window.scrollY / max * 100))) : 0;
    progressFill.style.width = percent + '%';
    progressLabel.textContent = '%' + percent;
    progressTrack.setAttribute('aria-valuenow', String(percent));
    const anchor = window.scrollY + window.innerHeight * .32;
    let active = chapters[0];
    for (const section of chapters) {
      if (section.getBoundingClientRect().top + window.scrollY <= anchor) active = section;
      else break;
    }
    if (active) setActiveChapter(Number(active.dataset.chapter));
  }
  let scrollTimer = 0;
  window.addEventListener('scroll', () => {
    if (scrollTimer) return;
    scrollTimer = window.setTimeout(() => { onScroll(); scrollTimer = 0; }, 50);
  }, {passive:true});
  window.addEventListener('resize', onScroll);
  updateAudioCaption(); onScroll();

  function galleryFor(button) { return button.dataset.gallery === 'references' ? referenceButtons : sceneButtons; }
  function showImage(index) {
    if (!currentGallery.length) return;
    currentImageIndex = (index + currentGallery.length) % currentGallery.length;
    const button = currentGallery[currentImageIndex];
    const img = button.querySelector('img');
    lightboxImage.src = img.currentSrc || img.src;
    lightboxImage.alt = img.alt;
    lightboxTitle.textContent = button.dataset.title || img.alt;
    previousButton.disabled = currentGallery.length < 2;
    nextButton.disabled = currentGallery.length < 2;
  }
  document.querySelectorAll('.artwork-button').forEach(button => button.addEventListener('click', () => {
    returnFocus = button;
    currentGallery = galleryFor(button);
    showImage(Number(button.dataset.index));
    lightbox.showModal();
    closeButton.focus();
  }));
  previousButton.addEventListener('click', () => showImage(currentImageIndex - 1));
  nextButton.addEventListener('click', () => showImage(currentImageIndex + 1));
  function closeLightbox() {
    if (lightbox.open) lightbox.close();
  }
  closeButton.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', event => { if (event.target === lightbox) closeLightbox(); });
  lightbox.addEventListener('close', () => { if (returnFocus) returnFocus.focus(); });
  document.addEventListener('keydown', event => {
    if (!lightbox.open) return;
    if (event.key === 'ArrowRight') showImage(currentImageIndex + 1);
    if (event.key === 'ArrowLeft') showImage(currentImageIndex - 1);
  });
})();
