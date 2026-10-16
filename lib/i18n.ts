'use client'
import { useStore } from './store'
import type { LibraryType, SortKey, Status } from './types'

export type Lang = 'en' | 'es'

/* Every user-facing string in the app, grouped by screen/section so a
   translator (or future-you) can find things by where they appear rather
   than by an arbitrary flat key. Values that need to embed data are
   functions instead of plain strings. */
const dict = {
  en: {
    nav: { home: 'Home', series: 'Series', anime: 'Anime', movies: 'Movies', settings: 'Settings', search: 'Search' },

    type: { movies: 'Movies', series: 'Series', anime: 'Anime', movie: 'Movie' } as Record<LibraryType | 'movie', string>,

    status: {
      pending: 'Pending', watching: 'Watching', watched: 'Watched',
      none: 'No status', setStatus: 'Set status', removeStatus: 'Remove Status',
      tapToChange: (label: string) => `Status: ${label}. Tap to change`,
    },

    home: {
      title: 'Home',
      watching: 'Watching', comingSoon: 'Coming Soon', interests: 'Based on Your Interests',
      showLess: 'Show less', allCount: (n: number) => `All · ${n}`,
      emptyWatching: 'Nothing marked as Watching yet — set a status from any title’s detail sheet.',
      checkingEpisodes: 'Checking for new episodes…',
      emptyComingSoon: 'No new episodes scheduled for anything you’re keeping an eye on.',
      findingPicks: 'Finding picks for you…',
      emptyInterests: 'Rate or mark a few titles as watched to get personalized picks.',
    },

    library: {
      itemCount: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
      searchAria: (type: string) => `Search ${type}`,
      searchPlaceholder: (type: string) => `Search ${type.toLowerCase()}…`,
      closeSearch: 'Close search',
      searchLibraryAria: 'Search library',
      sortOptionsAria: 'Sort options',
      sortWord: 'Sort',
      filterAll: 'All',
      noResults: 'No results',
      emptyLibraryTitle: 'Your list is empty',
      tryDifferentFilter: 'Try a different filter or sort option.',
      emptyLibraryBody: (type: string) => `You don't have any ${type.toLowerCase()} in your library yet.`,
      searchTitles: 'Search titles',
      noLocalMatch: (type: string, q: string) => `No ${type.toLowerCase()} in your list match "${q}" — search results:`,
      searching: 'Searching…',
      noTmdbMatch: (type: string, q: string) => `No ${type.toLowerCase()} found for "${q}" either.`,
      removedToast: (title: string) => `"${title}" removed`,
      deleteAria: (title: string) => `Delete ${title}`,
      syncingLabel: 'syncing',
      searchTmdbCta: (q: string) => `Search all titles for "${q}"`,
      otherResultsFor: (q: string) => `Other matches for "${q}":`,
    },

    sort: {
      status: 'Status Priority',
      'myRating-desc': 'My Rating: Highest first',
      'myRating-asc': 'My Rating: Lowest first',
      'score-desc': 'Online Score: Highest',
      'score-asc': 'Online Score: Lowest',
      'title-asc': 'Title: A → Z',
      'title-desc': 'Title: Z → A',
      'added-desc': 'Recently Added',
    } as Record<SortKey, string>,

    search: {
      placeholder: 'Search series, anime, movies…',
      inputAria: 'Search media',
      clearAria: 'Clear search',
      searching: 'Searching…',
      noResultsFor: (q: string) => `No results for "${q}"`,
      findAnything: 'Find anything',
      hintPrefix: 'Search series, anime, or movies. Tap',
      hintSuffix: 'to add instantly.',
      resultsAria: 'Search results',
      addAria: (title: string) => `Add ${title}`,
      resultAria: (title: string, type: string) => `${title} — ${type}`,
      alreadyInLibrary: (title: string) => `"${title}" already in library`,
      addedToast: (title: string) => `"${title}" added`,
    },

    settings: {
      preferences: 'Preferences',
      language: 'Language',
      streamingRegion: 'Streaming Region',
      streamingRegionAria: 'Streaming region',
      regionChangedToast: (code: string) => `Region → ${code}`,
      exportLibrary: 'Export Library',
      exportHint: 'Download a complete JSON backup.',
      downloadBtn: 'Download library.json',
      exportedToast: 'Library exported ✓',
      importLibrary: 'Import Library',
      readBeforeImporting: 'Read before importing',
      importSteps: [
        'Export a backup first.',
        'Merges by ID — existing items are overwritten.',
        'Accepts "id" or "tmdb_id" fields.',
        'Posters & ratings sync automatically.',
      ],
      importBtn: 'Choose .json to import',
      cannotParseJson: '⚠️ Cannot parse JSON',
      missingLibraryKey: '⚠️ Missing "library" key',
      noValidItems: '⚠️ No valid items',
      importedToast: (n: number) => `Imported ${n} item${n !== 1 ? 's' : ''} ✓ — syncing…`,
      syncedToast: (n: number) => `✓ Synced ${n} item${n !== 1 ? 's' : ''}`,
      localDataNote: 'All data is stored locally on this device.',
    },

    account: {
      signInTitle: 'Sign in to see your library.', createTitle: 'Create account', createSub: 'Your library, on every device.',
      name: 'Name', username: 'Username', password: 'Password', repeatPassword: 'Repeat password',
      signIn: 'Sign in', create: 'Create account', oneMoment: 'One moment…',
      toSignup: 'No account? Create one', toLogin: 'I already have an account',
      usernameHint: 'Username: lowercase letters, numbers, dot, dash or underscore.',
      passwordsDiffer: 'The passwords don’t match.',
      errOffline: 'No connection. Try again in a moment.', errWrong: 'Wrong username or password.',
      errTaken: 'That username is taken.', errTooMany: 'Too many attempts. Wait a few minutes.',
      cantReach: 'Can’t reach RoscaTV', checkConnection: 'Check your connection and try again.', tryAgain: 'Try again',
      title: 'Account', signedInAs: (name: string) => `Signed in as ${name}`, signOut: 'Sign out',
      syncedNote: 'Your library is saved on your server and kept in sync across your devices.',
    },

    sheet: {
      close: 'Close',
      detailsFor: (title: string) => `Details for ${title}`,
      overview: 'Overview', episodes: 'Episodes',
      overallRating: 'Overall rating', myScore: 'My score',
      seasonAverage: (avg: string) => `Season average ${avg} · your overall score is set independently`,
      done: 'Done ▴',
      clear: 'Clear', clearAria: (label: string) => `Clear ${label}`,
      watchingForThis: 'Watching for this', keepAnEyeOnThis: 'Keep an eye on this',
      moreDetails: 'More details',
      watchIn: (region: string) => `Watch in ${region}`,
      loading: 'Loading…',
      notAvailable: 'Not available.',
      criticRatings: 'Critic Ratings',
      noCriticScores: 'No critic scores available.',
      privateNotes: 'Private Notes',
      notesPlaceholder: 'Your thoughts, spoilers, recommendations…',
      notesAria: 'Private notes',
      moreLikeThis: 'More Like This',
      allCount: (n: number) => `All · ${n}`,
      findingSimilar: 'Finding similar titles…',
      episodesUnavailable: 'Episode tracking is only available for series.',
      loadingSeasons: 'Loading seasons…',
      noSeasonData: 'No season data available.',
      showingNOfM: (n: number, m: number) => `Showing ${n} of ${m} seasons`,
      season: (n: number) => `Season ${n}`,
      tapToMarkHint: 'Tap to mark · double-tap to fill up to here',
      epAria: (n: number, watched: boolean) => `Ep ${n}${watched ? ' (watched)' : ''} — double-tap to fill up to here`,
      showMore: (n: number) => `Show more (+${n} ep${n !== 1 ? 's' : ''})`,
      showLess: 'Show less ↑',
      avg: 'AVG', tmdb: 'TMDB', my: 'MY',
      criticRatingsAria: 'Critic ratings', drawerSectionsAria: 'Drawer sections',
      save: 'Save', saveDirty: 'Save ●', remove: 'Remove',
      saveChangesTitle: 'Save changes?',
      saveChangesBody: 'You have unsaved changes on this title.',
      saveAndExit: 'Save & Exit', discardChanges: 'Discard changes', cancelKeepEditing: 'Cancel and keep editing',
      savedToLibrary: 'Saved to library',
      removedFromLibrary: 'Removed from library',
    },
  },

  es: {
    nav: { home: 'Inicio', series: 'Series', anime: 'Anime', movies: 'Películas', settings: 'Ajustes', search: 'Buscar' },

    type: { movies: 'Películas', series: 'Series', anime: 'Anime', movie: 'Película' } as Record<LibraryType | 'movie', string>,

    status: {
      pending: 'Pendiente', watching: 'Viendo', watched: 'Vista',
      none: 'Sin estado', setStatus: 'Elegir estado', removeStatus: 'Quitar estado',
      tapToChange: (label: string) => `Estado: ${label}. Toca para cambiar`,
    },

    home: {
      title: 'Inicio',
      watching: 'Viendo', comingSoon: 'Próximamente', interests: 'Según tus intereses',
      showLess: 'Ver menos', allCount: (n: number) => `Todo · ${n}`,
      emptyWatching: 'Nada marcado como Viendo todavía — pon un estado desde la ficha de cualquier título.',
      checkingEpisodes: 'Buscando nuevos episodios…',
      emptyComingSoon: 'No hay episodios nuevos programados para lo que estás siguiendo.',
      findingPicks: 'Buscando recomendaciones para ti…',
      emptyInterests: 'Puntúa o marca como vistos algunos títulos para recibir recomendaciones personalizadas.',
    },

    library: {
      itemCount: (n: number) => `${n} ${n === 1 ? 'título' : 'títulos'}`,
      searchAria: (type: string) => `Buscar en ${type}`,
      searchPlaceholder: (type: string) => `Buscar en ${type.toLowerCase()}…`,
      closeSearch: 'Cerrar búsqueda',
      searchLibraryAria: 'Buscar en la biblioteca',
      sortOptionsAria: 'Opciones de orden',
      sortWord: 'Ordenar',
      filterAll: 'Todo',
      noResults: 'Sin resultados',
      emptyLibraryTitle: 'Tu lista está vacía',
      tryDifferentFilter: 'Prueba otro filtro o forma de ordenar.',
      emptyLibraryBody: (type: string) => `Todavía no tienes ${type.toLowerCase()} en tu biblioteca.`,
      searchTitles: 'Buscar títulos',
      noLocalMatch: (type: string, q: string) => `Ningún título de ${type.toLowerCase()} en tu lista coincide con "${q}" — resultados de búsqueda:`,
      searching: 'Buscando…',
      noTmdbMatch: (type: string, q: string) => `Tampoco se encontró ${type.toLowerCase()} para "${q}".`,
      removedToast: (title: string) => `"${title}" eliminado`,
      deleteAria: (title: string) => `Eliminar ${title}`,
      syncingLabel: 'sincronizando',
      searchTmdbCta: (q: string) => `Buscar todos los títulos para "${q}"`,
      otherResultsFor: (q: string) => `Otras coincidencias para "${q}":`,
    },

    sort: {
      status: 'Prioridad de estado',
      'myRating-desc': 'Mi nota: de mayor a menor',
      'myRating-asc': 'Mi nota: de menor a mayor',
      'score-desc': 'Puntuación online: mayor primero',
      'score-asc': 'Puntuación online: menor primero',
      'title-asc': 'Título: A → Z',
      'title-desc': 'Título: Z → A',
      'added-desc': 'Añadidos recientemente',
    } as Record<SortKey, string>,

    search: {
      placeholder: 'Busca series, anime, películas…',
      inputAria: 'Buscar contenido',
      clearAria: 'Borrar búsqueda',
      searching: 'Buscando…',
      noResultsFor: (q: string) => `Sin resultados para "${q}"`,
      findAnything: 'Encuentra lo que sea',
      hintPrefix: 'Busca series, anime o películas. Toca',
      hintSuffix: 'para añadir al instante.',
      resultsAria: 'Resultados de búsqueda',
      addAria: (title: string) => `Añadir ${title}`,
      resultAria: (title: string, type: string) => `${title} — ${type}`,
      alreadyInLibrary: (title: string) => `«${title}» ya está en la biblioteca`,
      addedToast: (title: string) => `«${title}» añadido`,
    },

    settings: {
      preferences: 'Preferencias',
      language: 'Idioma',
      streamingRegion: 'Región de streaming',
      streamingRegionAria: 'Región de streaming',
      regionChangedToast: (code: string) => `Región → ${code}`,
      exportLibrary: 'Exportar biblioteca',
      exportHint: 'Descarga una copia de seguridad completa en JSON.',
      downloadBtn: 'Descargar library.json',
      exportedToast: 'Biblioteca exportada ✓',
      importLibrary: 'Importar biblioteca',
      readBeforeImporting: 'Lee esto antes de importar',
      importSteps: [
        'Exporta primero una copia de seguridad.',
        'Se combina por ID — los títulos existentes se sobrescriben.',
        'Acepta los campos "id" o "tmdb_id".',
        'Los pósters y las puntuaciones se sincronizan solos.',
      ],
      importBtn: 'Elegir .json para importar',
      cannotParseJson: '⚠️ No se pudo leer el JSON',
      missingLibraryKey: '⚠️ Falta la clave "library"',
      noValidItems: '⚠️ No hay títulos válidos',
      importedToast: (n: number) => `${n} título${n !== 1 ? 's' : ''} importado${n !== 1 ? 's' : ''} ✓ — sincronizando…`,
      syncedToast: (n: number) => `✓ ${n} título${n !== 1 ? 's' : ''} sincronizado${n !== 1 ? 's' : ''}`,
      localDataNote: 'Todos los datos se guardan localmente en este dispositivo.',
    },

    account: {
      signInTitle: 'Inicia sesión para ver tu biblioteca.', createTitle: 'Crear cuenta', createSub: 'Tu biblioteca, en todos tus dispositivos.',
      name: 'Nombre', username: 'Usuario', password: 'Contraseña', repeatPassword: 'Repite la contraseña',
      signIn: 'Entrar', create: 'Crear cuenta', oneMoment: 'Un momento…',
      toSignup: '¿Sin cuenta? Crea una', toLogin: 'Ya tengo cuenta',
      usernameHint: 'Usuario: minúsculas, números, punto, guion o guion bajo.',
      passwordsDiffer: 'Las contraseñas no coinciden.',
      errOffline: 'Sin conexión. Inténtalo en un momento.', errWrong: 'Usuario o contraseña incorrectos.',
      errTaken: 'Ese usuario ya existe.', errTooMany: 'Demasiados intentos. Espera unos minutos.',
      cantReach: 'No se puede conectar con RoscaTV', checkConnection: 'Revisa la conexión y vuelve a intentarlo.', tryAgain: 'Reintentar',
      title: 'Cuenta', signedInAs: (name: string) => `Sesión iniciada como ${name}`, signOut: 'Cerrar sesión',
      syncedNote: 'Tu biblioteca se guarda en tu servidor y se sincroniza entre tus dispositivos.',
    },

    sheet: {
      close: 'Cerrar',
      detailsFor: (title: string) => `Detalles de ${title}`,
      overview: 'Resumen', episodes: 'Episodios',
      overallRating: 'Puntuación general', myScore: 'Mi puntuación',
      seasonAverage: (avg: string) => `Media de temporadas ${avg} · tu puntuación general se pone aparte`,
      done: 'Listo ▴',
      clear: 'Borrar', clearAria: (label: string) => `Borrar ${label}`,
      watchingForThis: 'Siguiéndolo', keepAnEyeOnThis: 'Echarle un ojo',
      moreDetails: 'Más detalles',
      watchIn: (region: string) => `Dónde verlo en ${region}`,
      loading: 'Cargando…',
      notAvailable: 'No disponible.',
      criticRatings: 'Puntuaciones de la crítica',
      noCriticScores: 'No hay puntuaciones de crítica disponibles.',
      privateNotes: 'Notas privadas',
      notesPlaceholder: 'Tus impresiones, spoilers, recomendaciones…',
      notesAria: 'Notas privadas',
      moreLikeThis: 'Más como esto',
      allCount: (n: number) => `Todo · ${n}`,
      findingSimilar: 'Buscando títulos similares…',
      episodesUnavailable: 'El seguimiento de episodios solo está disponible para series.',
      loadingSeasons: 'Cargando temporadas…',
      noSeasonData: 'No hay datos de temporadas disponibles.',
      showingNOfM: (n: number, m: number) => `Mostrando ${n} de ${m} temporadas`,
      season: (n: number) => `Temporada ${n}`,
      tapToMarkHint: 'Toca para marcar · doble toque para rellenar hasta aquí',
      epAria: (n: number, watched: boolean) => `Ep ${n}${watched ? ' (visto)' : ''} — doble toque para rellenar hasta aquí`,
      showMore: (n: number) => `Ver más (+${n} ep${n !== 1 ? 's' : ''})`,
      showLess: 'Ver menos ↑',
      avg: 'MEDIA', tmdb: 'TMDB', my: 'YO',
      criticRatingsAria: 'Puntuaciones de la crítica', drawerSectionsAria: 'Secciones',
      save: 'Guardar', saveDirty: 'Guardar ●', remove: 'Quitar',
      saveChangesTitle: '¿Guardar los cambios?',
      saveChangesBody: 'Tienes cambios sin guardar en este título.',
      saveAndExit: 'Guardar y salir', discardChanges: 'Descartar cambios', cancelKeepEditing: 'Cancelar y seguir editando',
      savedToLibrary: 'Guardado en la biblioteca',
      removedFromLibrary: 'Eliminado de la biblioteca',
    },
  },
}

export type Translations = typeof dict['en']

export function getT(lang: Lang): Translations {
  return dict[lang] ?? dict.en
}

/* Reads the current language straight from the store so every component
   re-renders automatically the instant Moe flips it in Settings. */
export function useT(): Translations {
  const lang = useStore(s => s.settings.language)
  return getT(lang)
}

/* Status label lookup shared by every place that renders a Status value
   (StatusDot's menu, the header StatusPill, filter tabs, search results). */
export function statusLabel(t: Translations, status: Status | null): string {
  return status ? t.status[status] : t.status.none
}
