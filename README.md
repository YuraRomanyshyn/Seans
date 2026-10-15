# Seans – lista filmów i seriali

Appka webowa (PWA) na iPhone'a. Wyszukujesz tytuł, czytasz opis, sprawdzasz, na jakiej platformie jest dostępny w Polsce, i dodajesz go do swojej listy.

## Co jest w środku

| Plik | Do czego służy |
|---|---|
| `index.html` | Wygląd obu stron: listy i wyszukiwarki |
| `style.css` | Kolory i układ |
| `app.js` | Cała logika: wyszukiwanie, lista, oceny, usuwanie przesunięciem |
| `manifest.webmanifest` | Nazwa i ikona appki na ekranie iPhone'a |
| `sw.js` | Działanie offline i zapamiętywanie okładek |
| `icons/` | Ikony appki |

## Czcionki

Tytuły: **Roboto**, reszta tekstu: **Manrope**. Obie ładują się automatycznie z Google Fonts.

## Krok 1: klucz TMDB (ok. 5 minut, za darmo)

1. Wejdź na https://www.themoviedb.org/signup i załóż konto. Potwierdź adres e-mail.
2. Zaloguj się i otwórz https://www.themoviedb.org/settings/api
3. Kliknij **Create** / **Request an API key** i wybierz **Developer** (użytek prywatny).
4. Zaakceptuj warunki i wypełnij krótki formularz. Nazwa aplikacji: `Seans`. Typ: `Personal`. Adres strony: Twój adres z GitHub Pages (krok 2) albo `http://localhost`. Opis: `Prywatna lista filmów do obejrzenia`.
5. Skopiuj **API Key** (krótki ciąg znaków). Zadziała też dłuższy **API Read Access Token**.

Klucz wklejasz w samej appce, przy pierwszym uruchomieniu. Nie trafia do plików na GitHubie, więc repozytorium może być publiczne.

## Krok 2: publikacja na GitHub Pages

1. Zaloguj się na https://github.com i kliknij **New repository**.
2. Nazwa: `seans`. Ustaw **Public** (darmowe GitHub Pages wymagają publicznego repozytorium). Kliknij **Create repository**.
3. Na stronie nowego repozytorium kliknij **uploading an existing file**.
4. Rozpakuj zip i przeciągnij **zawartość** folderu `seans` (pliki i folder `icons`, nie sam folder `seans`). Kliknij **Commit changes**.
5. Wejdź w **Settings → Pages**. W **Source** wybierz **Deploy from a branch**, gałąź **main**, folder **/ (root)**. Kliknij **Save**.
6. Po 1–2 minutach appka będzie pod adresem `https://TWOJ-LOGIN.github.io/seans/`

## Krok 3: instalacja na iPhonie

1. Otwórz adres z kroku 2 w **Safari**.
2. Stuknij **Udostępnij** (kwadrat ze strzałką) → **Dodaj do ekranu początkowego** → **Dodaj**.
3. Uruchom appkę **z ikony na ekranie** i dopiero tam wklej klucz TMDB. Zainstalowana appka ma osobną pamięć niż karta w Safari.

## Jak korzystać

- **Szukaj**: wpisz tytuł, stuknij wynik, przeczytaj opis i sprawdź platformy, potem **Dodaj do mojej listy**.
- **Moja lista**: przy każdym tytule masz „Obejrzane” i kciuki 👍 / 👎. Ponowne stuknięcie kciuka zdejmuje ocenę.
- **Usuwanie**: przesuń tytuł w lewo i stuknij **Usuń**. Mocne przesunięcie do końca usuwa od razu. Przez 5 sekund możesz stuknąć **Cofnij**.
- **Kopia zapasowa** (koło zębate): lista jest zapisana tylko na telefonie. Eksportuj ją co jakiś czas i zawsze przed usunięciem appki z ekranu.

## Aktualizacja appki

Wgraj zmienione pliki do repozytorium tak samo jak w kroku 2 (**Add file → Upload files**). Appka pobierze nową wersję przy kolejnym uruchomieniu z internetem. Twoja lista zostaje.

---
Dane o filmach pochodzą z TMDB, a dostępność na platformach z JustWatch (przez TMDB). Ta appka korzysta z API TMDB, ale nie jest przez TMDB wspierana ani certyfikowana.
