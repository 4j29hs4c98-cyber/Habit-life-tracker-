// Translations. English texts are the keys; German is looked up when the app is set to German.
// {name}-style placeholders are filled in by tr(text, { name: value }).

const DE = {
  // navigation + general
  'Today': 'Heute', 'Habits': 'Gewohnheiten', 'Tasks': 'Aufgaben', 'Training': 'Training', 'Settings': 'Einstellungen',
  'Habit & Life': 'Habit & Life', 'Tracker': 'Tracker',
  'Add': 'Hinzufügen', 'Cancel': 'Abbrechen', 'Save': 'Speichern', 'Delete': 'Löschen', 'Done': 'Erledigt', 'Open': 'Öffnen',
  'Name': 'Name', 'Later': 'Später', 'Close': 'Fertig', 'Something went wrong. Try again.': 'Etwas ist schiefgelaufen. Versuch es nochmal.',
  'today': 'heute', 'of': 'von', 'just now': 'gerade eben', '{n} min ago': 'vor {n} Min.', '{n} h ago': 'vor {n} Std.',
  'MTWTFSS': 'MDMDFSS', 'W{n}': 'W{n}', 'week {n}': 'Woche {n}',

  // areas
  'Health': 'Gesundheit', 'Mind': 'Geist', 'Productivity': 'Produktivität', 'Lifestyle': 'Lifestyle',
  'Work & school': 'Arbeit & Schule', 'Finance': 'Finanzen',
  'Area': 'Bereich', 'Areas': 'Bereiche', 'By area': 'Nach Bereich', 'Manage areas': 'Bereiche verwalten', 'No area': 'Kein Bereich',
  '+ New area': '+ Neuer Bereich', 'New area': 'Neuer Bereich', 'Edit area': 'Bereich bearbeiten', 'Add area': 'Bereich hinzufügen',
  'Icon': 'Symbol', 'Pick an icon': 'Symbol auswählen', 'e.g. Music': 'z. B. Musik', 'Area saved': 'Bereich gespeichert',
  'Restore built-in areas': 'Standard-Bereiche wiederherstellen', 'Built-in areas restored': 'Standard-Bereiche wiederhergestellt',
  'Areas group your habits. Rename the built-in ones, delete what you don\'t need, or add your own.':
    'Bereiche gruppieren deine Gewohnheiten. Benenne die vorhandenen um, lösche, was du nicht brauchst, oder füge eigene hinzu.',
  'Group your habits into areas like Health or Music. Add your own with "Manage areas".':
    'Ordne deine Gewohnheiten Bereichen wie Gesundheit oder Musik zu. Eigene legst du über „Bereiche verwalten“ an.',
  'Delete "{name}"?': '„{name}“ löschen?',
  'Delete "{name}"? Its {n} habits stay, without an area.': '„{name}“ löschen? Die {n} Gewohnheiten darin bleiben, nur ohne Bereich.',

  // today
  'Habits today': 'Gewohnheiten heute', 'Habits done today': 'Heute erledigte Gewohnheiten', 'Current streak': 'Aktuelle Serie',
  '{n} day': '{n} Tag', '{n} days': '{n} Tage', '{n} d': '{n} T.',
  'No habits yet. Add your own, or start with a set of common ones you can edit.':
    'Noch keine Gewohnheiten. Füge eigene hinzu oder starte mit ein paar typischen, die du anpassen kannst.',
  'Add a habit': 'Gewohnheit hinzufügen', 'Use starter set': 'Startpaket nutzen',
  'This month': 'Dieser Monat', 'Completed': 'Erledigt', 'Perfect days': 'Perfekte Tage', 'Longest streak now': 'Längste Serie gerade',
  '{name} leads.': '{name} liegt vorne.', 'Due today': 'Heute fällig', 'Add task': 'Aufgabe hinzufügen',
  'Nothing due. Plan something on the Tasks tab.': 'Nichts fällig. Plane etwas im Tab „Aufgaben“.',
  'Workout planned': 'Training geplant', '{done} of {total} exercises done': '{done} von {total} Übungen erledigt', ', {n} cardio': ', {n} Cardio',
  'Rest day, or nothing planned yet.': 'Ruhetag oder noch nichts geplant.',

  // habits
  'Previous month': 'Vorheriger Monat', 'Next month': 'Nächster Monat', 'completed': 'erledigt', 'perfect days': 'perfekte Tage',
  'check-ins': 'Abhaken', 'Add habit': 'Gewohnheit hinzufügen', 'Daily': 'Täglich', 'Habit': 'Gewohnheit', 'Edit habit': 'Gewohnheit bearbeiten',
  'New habit': 'Neue Gewohnheit', 'e.g. Drink 2 L of water': 'z. B. 2 L Wasser trinken',
  'Best streak: {best} days. Current: {cur} days.': 'Beste Serie: {best} Tage. Aktuell: {cur} Tage.',
  'Delete this habit and its history?': 'Diese Gewohnheit samt Verlauf löschen?', 'Habit deleted': 'Gewohnheit gelöscht',
  'Starter habits added': 'Startpaket hinzugefügt', '{n} habit': '{n} Gewohnheit', '{n} habits': '{n} Gewohnheiten',
  'Weekly habits': 'Wöchentliche Gewohnheiten', 'New weekly habit': 'Neue wöchentliche Gewohnheit', 'Edit weekly habit': 'Wöchentliche Gewohnheit bearbeiten',
  'Things you do once a week, like laundry or meal prep.': 'Dinge, die du einmal pro Woche machst, z. B. Wäsche oder Meal Prep.',
  'Add a few examples': 'Ein paar Beispiele hinzufügen',
  'Goals for {month}': 'Ziele für {month}', 'New goal for {month}': 'Neues Ziel für {month}', 'Goal': 'Ziel', 'Goals done': 'Erreichte Ziele',
  '{done} of {total} reached': '{done} von {total} erreicht', 'Delete goal': 'Ziel löschen',
  'Set a few goals for the month, like "Read one book".': 'Setz dir ein paar Ziele für den Monat, z. B. „Ein Buch lesen“.',

  // tasks
  'New task': 'Neue Aufgabe', 'Add a task…': 'Aufgabe hinzufügen…', 'Due date': 'Fällig am', 'Upcoming': 'Demnächst', 'No date': 'Ohne Datum',
  'Overdue, ': 'Überfällig, ', 'mark as done': 'als erledigt markieren', 'mark as not done': 'als offen markieren',
  'Finished tasks show up here.': 'Erledigte Aufgaben erscheinen hier.', 'Nothing here. Add a task above.': 'Hier ist nichts. Füge oben eine Aufgabe hinzu.',
  'Edit task': 'Aufgabe bearbeiten', 'Task': 'Aufgabe', 'Project': 'Projekt', 'Notes': 'Notizen', 'No project': 'Kein Projekt',
  'Task added': 'Aufgabe hinzugefügt', 'Task done': 'Aufgabe erledigt', 'Task deleted': 'Aufgabe gelöscht',
  'Projects': 'Projekte', 'Add project': 'Projekt hinzufügen', 'New project': 'Neues Projekt', 'Edit project': 'Projekt bearbeiten', 'Deadline': 'Deadline',
  '{done} of {total} tasks done': '{done} von {total} Aufgaben erledigt', '{n} days late': '{n} Tage zu spät', '{n} days to go': 'noch {n} Tage',
  'Group tasks into projects, like an exam, a trip or a side project.': 'Fasse Aufgaben in Projekten zusammen, z. B. eine Prüfung, eine Reise oder ein Nebenprojekt.',
  'Delete this project? Its tasks stay, without a project.': 'Dieses Projekt löschen? Die Aufgaben bleiben, nur ohne Projekt.',

  // training
  'Previous week': 'Vorherige Woche', 'Next week': 'Nächste Woche', 'exercises done': 'Übungen erledigt', 'kg moved': 'kg bewegt',
  'Copy last week': 'Letzte Woche kopieren', 'Muscle groups': 'Muskelgruppen', 'Muscle groups, e.g. Chest, Triceps': 'Muskelgruppen, z. B. Brust, Trizeps',
  'Exercise': 'Übung', 'kg': 'kg', 'Sets': 'Sätze', 'Reps': 'Wdh.', 'Rest': 'Pause', 'Cardio': 'Cardio', 'Min': 'Min', 'km/h': 'km/h', 'km': 'km',
  'Weight in kg': 'Gewicht in kg', 'Minutes': 'Minuten', 'Speed km/h': 'Tempo in km/h', 'Distance km': 'Strecke in km', '1 min': '1 Min',
  'Add exercise': 'Übung hinzufügen', 'Add cardio': 'Cardio hinzufügen', 'Remove exercise': 'Übung entfernen', 'Remove cardio': 'Cardio entfernen',
  'Copied {n} day': '{n} Tag kopiert', 'Copied {n} days': '{n} Tage kopiert', 'Nothing to copy from last week': 'Letzte Woche gibt es nichts zu kopieren',

  // settings
  'Appearance': 'Darstellung', 'Theme': 'Design', 'System': 'System', 'Light': 'Hell', 'Dark': 'Dunkel', 'Language': 'Sprache',
  'Your data': 'Deine Daten', '{n} items stored on this device.': '{n} Einträge auf diesem Gerät gespeichert.',
  'Export backup': 'Backup exportieren', 'Import backup': 'Backup importieren', 'Erase everything': 'Alles löschen',
  'Erase all habits, tasks and workouts on this device? Export a backup first if you want to keep them.':
    'Alle Gewohnheiten, Aufgaben und Trainings auf diesem Gerät löschen? Exportiere vorher ein Backup, wenn du sie behalten willst.',
  'Everything erased': 'Alles gelöscht', 'Imported {n} items': '{n} Einträge importiert', 'That file is not a valid backup.': 'Diese Datei ist kein gültiges Backup.',
  'Install': 'Installieren', 'Install app': 'App installieren', 'Add the app to your home screen or dock.': 'Füge die App deinem Homescreen oder Dock hinzu.',
  'This browser blocked local storage, so changes are lost when you close the app. Open it in a normal (not private) window.':
    'Dieser Browser blockiert den lokalen Speicher, deshalb gehen Änderungen beim Schließen verloren. Öffne die App in einem normalen (nicht privaten) Fenster.',

  // sync + account
  'Sync': 'Synchronisierung', 'Sync now': 'Jetzt synchronisieren', 'Sign in': 'Anmelden', 'Sign out': 'Abmelden', 'Signed in': 'Angemeldet',
  'Signed in as': 'Angemeldet als', 'Create account': 'Konto erstellen', 'Email': 'E-Mail', 'Password': 'Passwort', 'Not signed in': 'Nicht angemeldet',
  'Sign in to keep your phone and laptop in sync. Use the same account on every device.':
    'Melde dich an, damit Handy und Laptop synchron bleiben. Nutze auf jedem Gerät dasselbe Konto.',
  'Sync needs an internet connection the first time the app opens. Reopen the app while online.':
    'Beim ersten Öffnen braucht die Synchronisierung Internet. Öffne die App nochmal, während du online bist.',
  'Syncing…': 'Wird synchronisiert…', 'Offline. Changes sync when you are back online.': 'Offline. Änderungen werden synchronisiert, sobald du wieder online bist.',
  'Sync failed: {msg}': 'Synchronisierung fehlgeschlagen: {msg}', 'Synced {ago}': 'Synchronisiert {ago}', 'Ready to sync': 'Bereit zum Synchronisieren',
  '{n} change waiting.': '{n} Änderung wartet.', '{n} changes waiting.': '{n} Änderungen warten.',
  'Sign out? Your data stays on this device.': 'Abmelden? Deine Daten bleiben auf diesem Gerät.',
  'Check your email and confirm, then sign in here.': 'Schau in dein Postfach, bestätige die E-Mail und melde dich dann hier an.',
  'Forgot password?': 'Passwort vergessen?', 'Reset your password': 'Passwort zurücksetzen', 'Send link': 'Link senden',
  'Enter the email of your account. You\'ll get a link that opens the app, where you choose a new password.':
    'Gib die E-Mail deines Kontos ein. Du bekommst einen Link, der die App öffnet. Dort wählst du ein neues Passwort.',
  'If {email} has an account, a reset link is on its way. Check spam too.': 'Falls {email} ein Konto hat, ist ein Link unterwegs. Schau auch im Spam nach.',
  'Change password': 'Passwort ändern', 'Choose a new password': 'Neues Passwort wählen', 'New password': 'Neues Passwort',
  'Repeat new password': 'Neues Passwort wiederholen', 'Save password': 'Passwort speichern', 'Password changed': 'Passwort geändert',
  'You\'re signed in through the reset link. Set a new password to finish.': 'Du bist über den Link angemeldet. Leg jetzt ein neues Passwort fest.',
  'The two passwords are not the same.': 'Die beiden Passwörter stimmen nicht überein.',
  'That link has expired. Request a new one with "Forgot password".': 'Der Link ist abgelaufen. Fordere über „Passwort vergessen?“ einen neuen an.',
  'Wrong email or password.': 'E-Mail oder Passwort falsch.',
  'Please confirm your email first. Check your inbox and spam folder.': 'Bitte bestätige zuerst deine E-Mail. Schau in dein Postfach und den Spam-Ordner.',
  'Too many emails right now. The free plan sends at most 2 per hour, so try again later.': 'Gerade zu viele E-Mails. Der kostenlose Plan sendet höchstens 2 pro Stunde, versuch es später nochmal.',
  'This email already has an account. Sign in, or use "Forgot password".': 'Für diese E-Mail gibt es schon ein Konto. Melde dich an oder nutze „Passwort vergessen?“.',
  'The new password must be different from the old one.': 'Das neue Passwort muss sich vom alten unterscheiden.',
  'Please choose a longer password (at least 8 characters).': 'Bitte wähle ein längeres Passwort (mindestens 8 Zeichen).',
  'No connection. Try again when you are online.': 'Keine Verbindung. Versuch es nochmal, wenn du online bist.',
  'Sign in to sync first.': 'Melde dich zuerst für die Synchronisierung an.',

  // notifications
  'Notifications': 'Benachrichtigungen', 'Turn on notifications': 'Benachrichtigungen einschalten', 'Turning on…': 'Wird eingeschaltet…',
  'Turn off on this device': 'Auf diesem Gerät ausschalten', 'Send a test': 'Test senden',
  'On for this device.': 'Auf diesem Gerät an.', 'Off on this device.': 'Auf diesem Gerät aus.',
  'Notifications are on': 'Benachrichtigungen sind an', 'Turned off on this device': 'Auf diesem Gerät ausgeschaltet',
  'Test sent to {n} device': 'Test an {n} Gerät gesendet', 'Test sent to {n} devices': 'Test an {n} Geräte gesendet',
  'Could not deliver the test. Try turning notifications off and on again.': 'Der Test kam nicht an. Schalte die Benachrichtigungen aus und wieder ein.',
  'Morning overview': 'Morgen-Überblick', 'Habits, tasks due and today\'s workout': 'Gewohnheiten, fällige Aufgaben und heutiges Training',
  'Training reminder': 'Trainings-Erinnerung', 'Nudge to stick to your plan or get moving': 'Ein Anstoß, deinen Plan einzuhalten oder dich zu bewegen',
  'Evening check-in': 'Abend-Check', 'Which habits are still open': 'Welche Gewohnheiten noch offen sind',
  'These times apply to all your devices. You can also mute the app anytime in your phone\'s notification settings.':
    'Diese Zeiten gelten für alle deine Geräte. Du kannst die App auch jederzeit in den Benachrichtigungs-Einstellungen deines Handys stummschalten.',
  'Sign in to sync first. Reminders are sent from the server, so they need your account.':
    'Melde dich zuerst an. Erinnerungen kommen vom Server und brauchen deshalb dein Konto.',
  'To get notifications on iPad or iPhone, add the app to your Home Screen with Safari (Share > Add to Home Screen) and open it from there.':
    'Für Benachrichtigungen auf iPad oder iPhone füge die App mit Safari zum Home-Bildschirm hinzu (Teilen > Zum Home-Bildschirm) und öffne sie von dort.',
  'This browser can\'t show notifications.': 'Dieser Browser kann keine Benachrichtigungen anzeigen.',
  'This browser does not support notifications.': 'Dieser Browser unterstützt keine Benachrichtigungen.',
  'Notifications are blocked for this app. Allow them in your device or browser settings, then come back here.':
    'Benachrichtigungen sind für diese App blockiert. Erlaube sie in den Geräte- oder Browser-Einstellungen und komm dann hierher zurück.',
  'Notifications are blocked. Allow them for this app in your device or browser settings, then try again.':
    'Benachrichtigungen sind blockiert. Erlaube sie für diese App in den Geräte- oder Browser-Einstellungen und versuch es nochmal.',
  'Notifications were not allowed.': 'Benachrichtigungen wurden nicht erlaubt.',
  'On iPad and iPhone, first add the app to your Home Screen (Safari > Share > Add to Home Screen). Then open it from there and turn notifications on.':
    'Auf iPad und iPhone füge die App zuerst zum Home-Bildschirm hinzu (Safari > Teilen > Zum Home-Bildschirm). Öffne sie dann von dort und schalte die Benachrichtigungen ein.',
  'No device is registered yet. Turn on notifications on this device first.': 'Noch kein Gerät registriert. Schalte zuerst auf diesem Gerät die Benachrichtigungen ein.',

  // starter content
  'Drink 2 L of water': '2 L Wasser trinken', 'Morning stretching': 'Morgens dehnen', 'Read 10 pages': '10 Seiten lesen',
  'Plan tomorrow': 'Morgen planen', 'Deep work session': 'Konzentriert arbeiten', 'Make the bed': 'Bett machen', 'Track expenses': 'Ausgaben notieren',
  'Meal prep for the week': 'Meal Prep für die Woche', 'Do laundry': 'Wäsche waschen', 'Clean my room': 'Zimmer aufräumen', 'Review my budget': 'Budget prüfen',
  'Barbell bench press': 'Bankdrücken', 'Incline bench press': 'Schrägbankdrücken', 'Push-ups': 'Liegestütze', 'Dips': 'Dips',
  'Tricep pushdown': 'Trizepsdrücken am Kabel', 'Pull-ups': 'Klimmzüge', 'Seated row': 'Rudern sitzend', 'Lat pulldown': 'Latziehen',
  'Bicep curl': 'Bizepscurls', 'Squat': 'Kniebeugen', 'Deadlift': 'Kreuzheben', 'Leg press': 'Beinpresse', 'Lunges': 'Ausfallschritte',
  'Shoulder press': 'Schulterdrücken', 'Lateral raise': 'Seitheben', 'Plank': 'Unterarmstütz',
  'Treadmill': 'Laufband', 'Jogging': 'Joggen', 'Cycling': 'Radfahren', 'Rowing': 'Rudern', 'Swimming': 'Schwimmen', 'Jump rope': 'Seilspringen',
};

let lang = 'en';
export function setLang(l) { lang = l === 'de' ? 'de' : 'en'; }
export const getLang = () => lang;
export const LOC = () => (lang === 'de' ? 'de-DE' : 'en-GB');
export function tr(text, vars) {
  let out = (lang === 'de' && DE[text]) || text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return out;
}
export const missing = keys => keys.filter(k => !DE[k]); // used by tests
