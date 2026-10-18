// Translations. English texts are the keys; German is looked up when the app is set to German.
// {name}-style placeholders are filled in by tr(text, { name: value }).

const DE = {
  // navigation + general
  'Today': 'Heute', 'Habits': 'Gewohnheiten', 'Tasks': 'Aufgaben', 'Training': 'Training', 'Settings': 'Einstellungen',
  'Habit & Life': 'Habit & Life', 'Tracker': 'Tracker', 'Habit & Life Tracker': 'Habit & Life Tracker',
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
  // weekly plan
  'From your plan': 'Aus deinem Plan', 'Use plan for this day': 'Plan für diesen Tag verwenden', 'Weekly plan': 'Wochenplan',
  'Set up weekly plan': 'Wochenplan anlegen', 'Or copy last week': 'Oder letzte Woche kopieren', 'Rest day': 'Ruhetag',
  'Tip: set up a weekly plan once, and every week fills itself in automatically.': 'Tipp: Leg einmal einen Wochenplan an, dann füllt sich jede Woche automatisch.',
  'Rest day, or muscle groups, e.g. Chest': 'Ruhetag oder Muskelgruppen, z. B. Brust', 'Back to training': 'Zurück zum Training',
  'Your standard week. Every week fills itself in from this plan. If you change something on a specific day, only that day changes.':
    'Deine Standardwoche. Jede Woche füllt sich automatisch aus diesem Plan. Änderst du etwas an einem bestimmten Tag, ändert sich nur dieser Tag.',
  'Use this week as my plan': 'Diese Woche als Plan übernehmen', 'Delete plan': 'Plan löschen', 'Day reset to your plan': 'Tag auf deinen Plan zurückgesetzt',
  'Replace your weekly plan with the week of {date}?': 'Deinen Wochenplan durch die Woche vom {date} ersetzen?', 'Weekly plan saved': 'Wochenplan gespeichert',
  'Delete your weekly plan? Days you already changed stay as they are.': 'Deinen Wochenplan löschen? Tage, die du schon geändert hast, bleiben, wie sie sind.',
  'Weekly plan deleted': 'Wochenplan gelöscht',

  // year overview
  'Year overview': 'Jahresübersicht', 'Year in review': 'Jahresrückblick', 'Your year {y}': 'Dein Jahr {y}', 'Your year {y} is ready': 'Dein Jahr {y} ist fertig',
  'Previous year': 'Vorheriges Jahr', 'Next year': 'Nächstes Jahr', 'habits completed': 'Gewohnheiten erledigt', 'workouts': 'Trainings',
  'Most consistent': 'Am beständigsten', 'Best month': 'Bester Monat', 'Longest streak': 'Längste Serie',
  'Every day of the year': 'Jeder Tag des Jahres', 'none': 'keine', 'all habits': 'alle Gewohnheiten', 'Habits this year': 'Gewohnheiten in diesem Jahr',
  '{n} check-ins · best streak {b} days': '{n}× abgehakt · beste Serie {b} Tage', 'No habit data for this year yet.': 'Für dieses Jahr gibt es noch keine Gewohnheits-Daten.',
  'Training and tasks': 'Training und Aufgaben', 'Workouts per month': 'Trainings pro Monat', 'Workouts': 'Trainings',
  'Tasks completed': 'Erledigte Aufgaben', 'Goals reached': 'Erreichte Ziele',
  // calendar weeks, monthly review, reviews, PDF
  'CW {n}': 'KW {n}', 'Month review': 'Monatsrückblick', 'Monthly review': 'Monatsrückblick', 'Best week': 'Beste Woche', 'Weeks': 'Wochen',
  'Every day of the month': 'Jeder Tag des Monats', 'Habits this month': 'Gewohnheiten in diesem Monat', 'No habit data for this month yet.': 'Für diesen Monat gibt es noch keine Gewohnheits-Daten.',
  'Exercises done': 'Erledigte Übungen', 'Goals': 'Ziele', 'Save as PDF': 'Als PDF speichern', 'Creating…': 'Wird erstellt…',
  'PDF saved to your downloads': 'PDF in deinen Downloads gespeichert', 'Reviews': 'Rückblicke', 'Look back at any month or year, or save it as a PDF.': 'Schau auf jeden Monat oder jedes Jahr zurück oder speichere ihn als PDF.',
  'Year review {y}': 'Jahresrückblick {y}', 'Your {month} review is ready': 'Dein Rückblick auf {month} ist fertig', 'Review': 'Rueckblick',
  'Every day': 'Jeder Tag', 'created {date}': 'erstellt am {date}',
  'Could not load the PDF tool. Check your internet connection and try again.': 'Das PDF-Werkzeug konnte nicht geladen werden. Prüf deine Internetverbindung und versuch es nochmal.',
  // links & documents
  'Links & documents': 'Links & Dokumente', 'Nothing attached yet.': 'Noch nichts angehängt.', 'Paste a link…': 'Link einfügen…', 'Link': 'Link',
  'Title (optional)': 'Titel (optional)', 'Add link': 'Link hinzufügen', 'Add document': 'Dokument hinzufügen', 'Remove': 'Entfernen',
  'Up to 20 MB per file. Adding and opening documents needs internet.': 'Bis zu 20 MB pro Datei. Zum Hinzufügen und Öffnen von Dokumenten brauchst du Internet.',
  'Sign in to sync to attach documents. Links work without an account.': 'Melde dich an, um Dokumente anzuhängen. Links funktionieren auch ohne Konto.',
  'Uploading {name}…': '{name} wird hochgeladen…', 'Document added': 'Dokument hinzugefügt', "That doesn't look like a web address.": 'Das sieht nicht wie eine Internetadresse aus.',
  'Sign in to sync first to attach documents.': 'Melde dich zuerst an, um Dokumente anzuhängen.', 'Uploading documents needs an internet connection.': 'Zum Hochladen von Dokumenten brauchst du Internet.',
  'This file is larger than 20 MB.': 'Diese Datei ist größer als 20 MB.', 'Opening documents needs an internet connection.': 'Zum Öffnen von Dokumenten brauchst du Internet.',
  // schedules, mini versions, free days, comparison, insights
  'Schedule & target': 'Zeitplan & Ziel', 'How often': 'Wie oft', 'Every day': 'Jeden Tag', 'Specific days': 'Bestimmte Tage', '× per week': '× pro Woche',
  'Times per week': 'Wie oft pro Woche', '{n}× per week': '{n}× pro Woche',
  "Only the chosen days count. Other days don't lower your score.": 'Nur die gewählten Tage zählen. Andere Tage senken deine Quote nicht.',
  'Check it off on any days. The week counts once you reach the number.': 'Hak sie an beliebigen Tagen ab. Die Woche zählt, sobald du die Zahl erreichst.',
  'Target (optional)': 'Ziel (optional)', 'Unit': 'Einheit', 'Mini version (optional)': 'Mini-Version (optional)', 'Mini version': 'Mini-Version',
  'For busy days: a mini version keeps your streak going and counts as half in your stats.': 'Für volle Tage: Die Mini-Version hält deine Serie am Laufen und zählt in der Statistik halb.',
  'minutes': 'Minuten', 'pages': 'Seiten', 'times': 'Mal', 'glasses': 'Gläser', 'liters': 'Liter', 'steps': 'Schritte',
  'MINI': 'MINI', 'Mini': 'Mini', 'mini': 'Mini', 'free day': 'freier Tag', 'wk': 'Wo.', '{n} of {of} this week': '{n} von {of} diese Woche',
  '{n} week': '{n} Woche', '{n} weeks': '{n} Wochen', '{n} of {of} weeks reached · {c} check-ins': '{n} von {of} Wochen erreicht · {c}× abgehakt',
  'same as {when}': 'wie im {when}', 'vs {when}': 'ggü. {when}',
  'Insights': 'Erkenntnisse', 'Habits done by weekday, last 3 months': 'Erledigte Gewohnheiten nach Wochentag, letzte 3 Monate',
  '{day} is your best day': '{day} ist dein bester Tag', '{p} of habits done, {day} is the weakest ({q}).': '{p} der Gewohnheiten erledigt, {day} ist am schwächsten ({q}).',
  '"{name}" works best on {day}s': '„{name}“ klappt an {day}en am besten', 'Done on {a} of {b} {day}s in the last 3 months.': 'An {a} von {b} {day}en in den letzten 3 Monaten erledigt.',
  '"{name}" slipped': '„{name}“ ist abgerutscht', '{c} this month, down from {p}.': '{c} in diesem Monat, vorher {p}.',
  'A mini version for busy days might help.': 'Eine Mini-Version für volle Tage könnte helfen.', '"{name}" is improving': '„{name}“ wird besser',
  '{c} this month, up from {p}.': '{c} in diesem Monat, vorher {p}.', 'No clear patterns yet. Keep going.': 'Noch keine klaren Muster. Bleib dran.',
  'Insights appear after about two weeks of check-ins.': 'Erkenntnisse erscheinen nach etwa zwei Wochen Abhaken.',

  // exercise progress
  'Progress': 'Fortschritt', 'Progress chart': 'Fortschrittsdiagramm', 'Exercise progress': 'Übungsfortschritt', 'Back': 'Zurück',
  '{n} session': '{n} Einheit', '{n} sessions': '{n} Einheiten', 'sessions': 'Einheiten', '{n} reps': '{n} Wdh.', 'since {date}': 'seit {date}',
  'current weight': 'aktuelles Gewicht', 'current reps': 'aktuelle Wdh.', 'Last sessions': 'Letzte Einheiten', 'Best: {what} on {date}': 'Bestwert: {what} am {date}',
  'Check off exercises in your training plan, and their progress shows up here.': 'Hak Übungen in deinem Trainingsplan ab, dann erscheint hier ihr Fortschritt.',
  'No completed sessions yet.': 'Noch keine erledigten Einheiten.', 'The chart appears after your second session.': 'Das Diagramm erscheint nach deiner zweiten Einheit.',

  // delete account
  'Delete account': 'Konto löschen', 'Delete account…': 'Konto löschen…', 'Delete for good': 'Endgültig löschen', 'Confirmation': 'Bestätigung', 'DELETE': 'LÖSCHEN',
  "Deletes your account and everything stored in the cloud: habits, tasks, workouts, documents and notification settings, on all devices. This can't be undone.":
    'Löscht dein Konto und alles, was in der Cloud gespeichert ist: Gewohnheiten, Aufgaben, Trainings, Dokumente und Benachrichtigungs-Einstellungen, auf allen Geräten. Das lässt sich nicht rückgängig machen.',
  'Tip: export a backup first. You can import it again later.': 'Tipp: Exportiere vorher ein Backup. Du kannst es später wieder importieren.',
  'Everything in the cloud and on this device will be deleted. Type {word} to confirm.': 'Alles in der Cloud und auf diesem Gerät wird gelöscht. Gib zur Bestätigung {word} ein.',
  'Type {word} to confirm.': 'Gib zur Bestätigung {word} ein.', 'Your account was deleted': 'Dein Konto wurde gelöscht',
  // week grid
  'Week': 'Woche', 'Month': 'Monat', 'Grid view': 'Ansicht',
  // perfect day
  'Perfect day': 'Perfekter Tag', 'Every habit for today is done.': 'Alle Gewohnheiten für heute sind erledigt.',
  // navigation
  'Stats': 'Statistik', 'Year': 'Jahr', 'All reviews': 'Alle Rückblicke', 'New workout': 'Neues Training',
  // undo
  'Undo': 'Rückgängig', 'Restored': 'Wiederhergestellt', 'Project deleted': 'Projekt gelöscht', 'Weekly habit deleted': 'Wöchentliche Gewohnheit gelöscht',
  'Goal deleted': 'Ziel gelöscht', '"{name}" deleted': '„{name}“ gelöscht',
  // archive
  'Archive': 'Archivieren', 'Restore': 'Wiederherstellen', 'archived': 'archiviert', 'Archived habits': 'Archivierte Gewohnheiten', '"{name}" archived': '„{name}“ archiviert',
  '"{name}" restored': '„{name}“ wiederhergestellt', 'since {date}': 'seit {date}',
  'Habits you archive show up here. Their history stays in your stats.': 'Archivierte Gewohnheiten erscheinen hier. Ihr Verlauf bleibt in deiner Statistik.',
  "Archived on {date}. It doesn't show on Today or in the grids, but its history stays in your stats.": 'Archiviert am {date}. Sie erscheint nicht mehr bei „Heute“ und in den Rastern, aber ihr Verlauf bleibt in deiner Statistik.',
  // training on Today
  '{done} of {total} done': '{done} von {total} erledigt', 'min': 'Min.',
  // Today as one plan
  'Good morning': 'Guten Morgen', 'Good afternoon': 'Guten Tag', 'Good evening': 'Guten Abend', 'Good night': 'Gute Nacht',
  'Good morning, {name}': 'Guten Morgen, {name}', 'Good afternoon, {name}': 'Guten Tag, {name}', 'Good evening, {name}': 'Guten Abend, {name}', 'Good night, {name}': 'Gute Nacht, {name}',
  "Today's plan": 'Plan für heute', 'Plan for this day': 'Plan für diesen Tag', 'Plan progress': 'Fortschritt des Plans', '{done} of {total} completed': '{done} von {total} erledigt',
  'Nothing planned for this day.': 'Für diesen Tag ist nichts geplant.', 'Back to today': 'Zurück zu heute', 'Quick access': 'Schnellzugriff', 'Journal': 'Journal',
  'Overdue since {date}': 'Überfällig seit {date}', 'Workout': 'Training', '{done} of {total} exercises': '{done} von {total} Übungen', '{n} day streak': '{n} Tage in Folge', '1 day streak': '1 Tag in Folge',
  'Time (optional)': 'Uhrzeit (optional)', 'Your name': 'Dein Name', 'For the greeting on Today': 'Für die Begrüßung auf „Heute“',
  // training ring
  '{done} of {total} sets': '{done} von {total} Sätzen', 'Set {n}': 'Satz {n}', 'Muscle group': 'Muskelgruppe', 'Automatic': 'Automatisch',
  'Chest': 'Brust', 'Back': 'Rücken', 'Shoulders': 'Schultern', 'Biceps': 'Bizeps', 'Triceps': 'Trizeps', 'Legs': 'Beine', 'Core': 'Rumpf', 'Full body': 'Ganzkörper', 'Other': 'Sonstiges',
  'Add exercises below. Every set you finish fills the circle.': 'Füge unten Übungen hinzu. Jeder erledigte Satz füllt den Kreis.',
  'Tap the numbered circles after each set.': 'Tippe nach jedem Satz auf den nummerierten Kreis.', 'Workout complete. Well done!': 'Training geschafft. Stark!',
  'Workout complete': 'Training geschafft', 'Every set is done. Great work!': 'Alle Sätze erledigt. Starke Leistung!', 'exercises done this week': 'Übungen diese Woche erledigt',
  // journal + encryption
  'Entry saved': 'Eintrag gespeichert', 'entry': 'Eintrag', 'Set up your private journal': 'Richte dein privates Journal ein',
  'Your entries are locked with a passphrase that only you know. They are encrypted on this device before they are saved or synced, so nobody else can read them, not even with access to the database.': 'Deine Einträge werden mit einer Passphrase geschützt, die nur du kennst. Sie werden auf diesem Gerät verschlüsselt, bevor sie gespeichert oder synchronisiert werden. Niemand sonst kann sie lesen, auch nicht mit Zugriff auf die Datenbank.',
  'Important:': 'Wichtig:', 'If you forget your passphrase and lose your recovery key, your entries are gone for good. Nobody can recover them, not even the app.': 'Wenn du deine Passphrase vergisst und deinen Wiederherstellungsschlüssel verlierst, sind deine Einträge für immer verloren. Niemand kann sie zurückholen, auch nicht die App.',
  'Passphrase': 'Passphrase', 'Repeat passphrase': 'Passphrase wiederholen', 'At least {n} characters. A short sentence is easy to remember and hard to guess.': 'Mindestens {n} Zeichen. Ein kurzer Satz ist leicht zu merken und schwer zu erraten.',
  'Create journal': 'Journal erstellen', 'Your recovery key': 'Dein Wiederherstellungsschlüssel', 'Recovery key': 'Wiederherstellungsschlüssel',
  'Write this key down and keep it somewhere safe, for example on paper at home. It is shown only now. With it, you can open your journal if you ever forget your passphrase.': 'Schreib dir diesen Schlüssel auf und bewahre ihn sicher auf, zum Beispiel auf Papier zu Hause. Er wird nur jetzt angezeigt. Damit kannst du dein Journal öffnen, falls du deine Passphrase vergisst.',
  'Copy': 'Kopieren', 'Copied': 'Kopiert', 'I have written down my recovery key.': 'Ich habe meinen Wiederherstellungsschlüssel aufgeschrieben.', 'Continue': 'Weiter',
  'Please confirm that you have written down the key.': 'Bitte bestätige, dass du den Schlüssel aufgeschrieben hast.', 'Select the key and copy it by hand.': 'Markiere den Schlüssel und kopiere ihn von Hand.',
  'Use your recovery key': 'Wiederherstellungsschlüssel verwenden', 'New passphrase': 'Neue Passphrase', 'Unlock and set passphrase': 'Entsperren und Passphrase festlegen',
  'Your journal is locked': 'Dein Journal ist gesperrt', 'Unlock': 'Entsperren', 'Forgot your passphrase? Use your recovery key': 'Passphrase vergessen? Nutze deinen Wiederherstellungsschlüssel',
  'Write freely': 'Frei schreiben', 'Show a question': 'Frage anzeigen', 'Another question': 'Andere Frage', 'Your entry': 'Dein Eintrag', 'A few lines are enough.': 'Ein paar Zeilen reichen.',
  'Mood (optional)': 'Stimmung (optional)', 'Very bad': 'Sehr schlecht', 'Bad': 'Schlecht', 'Okay': 'Okay', 'Good': 'Gut', 'Very good': 'Sehr gut',
  'Save changes': 'Änderungen speichern', 'Save entry': 'Eintrag speichern', 'The journal is turned off.': 'Das Journal ist ausgeschaltet.', 'Turn on the journal': 'Journal einschalten',
  'Decrypting…': 'Wird entschlüsselt…', 'Lock journal': 'Journal sperren', 'Journal locked': 'Journal gesperrt', 'Open journal': 'Journal öffnen',
  'Change journal passphrase': 'Journal-Passphrase ändern', 'All entries are encrypted again with a new key. You will get a new recovery key; the old one stops working.': 'Alle Einträge werden mit einem neuen Schlüssel neu verschlüsselt. Du bekommst einen neuen Wiederherstellungsschlüssel, der alte gilt dann nicht mehr.',
  'Current passphrase': 'Aktuelle Passphrase', 'Change passphrase': 'Passphrase ändern', 'Export journal as text': 'Journal als Text exportieren',
  'This file is NOT encrypted. Anyone who opens it can read your entries. Keep it somewhere private and delete it when you no longer need it.': 'Diese Datei ist NICHT verschlüsselt. Wer sie öffnet, kann deine Einträge lesen. Bewahre sie privat auf und lösche sie, wenn du sie nicht mehr brauchst.',
  'Export anyway': 'Trotzdem exportieren', 'Journal exported': 'Journal exportiert', 'Unlock your journal first.': 'Entsperre zuerst dein Journal.',
  'The two passphrases are not the same.': 'Die beiden Passphrasen stimmen nicht überein.', 'Please use at least {n} characters.': 'Bitte verwende mindestens {n} Zeichen.',
  'Wrong passphrase. Please try again.': 'Falsche Passphrase. Bitte versuch es nochmal.', 'That recovery key does not match.': 'Dieser Wiederherstellungsschlüssel passt nicht.',
  'New passphrase saved': 'Neue Passphrase gespeichert', 'Write a few words or pick a mood first.': 'Schreib ein paar Worte oder wähle zuerst eine Stimmung.',
  'Entries are encrypted on this device with your journal passphrase. Nobody else can read them, not even with access to the database.': 'Einträge werden auf diesem Gerät mit deiner Journal-Passphrase verschlüsselt. Niemand sonst kann sie lesen, auch nicht mit Zugriff auf die Datenbank.',
  'Backups (Export backup) keep journal entries encrypted.': 'Backups („Backup exportieren“) enthalten die Journal-Einträge weiterhin verschlüsselt.', 'On': 'An', 'Off': 'Aus',
  'Open journal entry': 'Journal-Eintrag öffnen', 'Mood': 'Stimmung', 'Days with training': 'Tage mit Training', 'Days without training': 'Tage ohne Training', 'Perfect habit days': 'Perfekte Gewohnheits-Tage', 'Other days': 'Andere Tage',
  'Unlock your journal to see how your mood relates to training and habits. This is calculated only on your device.': 'Entsperre dein Journal, um zu sehen, wie deine Stimmung mit Training und Gewohnheiten zusammenhängt. Das wird nur auf deinem Gerät berechnet.',
  'Average mood from 1 to 5. A difference shows a pattern, not a cause.': 'Durchschnittliche Stimmung von 1 bis 5. Ein Unterschied zeigt ein Muster, keine Ursache.',
  'Not enough journal entries with a mood yet. Once you have at least 3 days in each group, a comparison appears here.': 'Noch nicht genug Einträge mit Stimmung. Sobald du in jeder Gruppe mindestens 3 Tage hast, erscheint hier ein Vergleich.',
  'Header image': 'Kopfbild', 'Current header image': 'Aktuelles Kopfbild', 'Choose a photo': 'Foto auswählen', 'Choose another photo': 'Anderes Foto auswählen',
  'Shown softly behind the Today header. It is stored privately with your account.': 'Wird dezent hinter dem Kopfbereich von „Heute“ angezeigt und privat mit deinem Konto gespeichert.',
  'Header image saved': 'Kopfbild gespeichert', 'Header image removed': 'Kopfbild entfernt', 'Please choose a photo.': 'Bitte wähle ein Foto.',
  'What went well today?': 'Was lief heute gut?', 'What will you do differently tomorrow?': 'Was machst du morgen anders?', 'What are you grateful for today?': 'Wofür bist du heute dankbar?',
  'What made you smile today?': 'Was hat dich heute zum Lächeln gebracht?', 'What was the hardest part of your day?': 'Was war heute am schwersten?', 'What did you learn today?': 'Was hast du heute gelernt?',
  'Who made your day better, and how?': 'Wer hat deinen Tag besser gemacht, und wie?', 'What drained your energy today?': 'Was hat dir heute Energie geraubt?', 'What gave you energy today?': 'Was hat dir heute Energie gegeben?',
  'What are you proud of today?': 'Worauf bist du heute stolz?', 'What would make tomorrow a good day?': 'Was würde morgen zu einem guten Tag machen?', 'Which habit felt easiest today, and why?': 'Welche Gewohnheit fiel dir heute am leichtesten, und warum?',
  'What got in the way of your plans today?': 'Was kam heute deinen Plänen in die Quere?', 'How did you take care of yourself today?': 'Wie hast du heute auf dich geachtet?',
  'What is one thing you want to remember about today?': 'Woran möchtest du dich von heute erinnern?', 'What worried you today, and how much does it matter?': 'Was hat dich heute beschäftigt, und wie wichtig ist es wirklich?',
  'What small win did you have today?': 'Welchen kleinen Erfolg hattest du heute?', 'What did your body need today?': 'Was hat dein Körper heute gebraucht?',
  'If today had a title, what would it be?': 'Wenn der heutige Tag einen Titel hätte, wie würde er lauten?', 'What are you looking forward to?': 'Worauf freust du dich?',
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
