function log(context, data) {
  const output = `${context}:\n ${JSON.stringify(data, null, 2)}\n`;
  console.warn("Output starting here");
  console.log(output);
}

const DJANGO_ICON_URL = "https://github.com/django.png";

// app generator:
//  python -c "from django.apps import apps; for app in apps.get_app_configs(): print(app.label)"

const ALWAYS_AVAILABLE_OPTIONS = [
  "--help",
  "--version",
  "--verbosity",
  "--settings",
  "--pythonpath",
  "--traceback",
  "--no-color",
  "--force-color",
];

const FULL_ALWAYS_AVAILABLE_OPTIONS = [
  {
    name: ["-h", "--help"],
    description: "show this help message and exit",
    priority: 49,
  },
  {
    name: "--version",
    description: "show program's version number and exit",
    priority: 49,
  },
  {
    name: ["-v", "--verbosity"],
    description:
      "Verbosity level; 0=minimal output, 1=normal output, 2=verbose output, 3=very verbose output",
    args: {
      name: "{0,1,2,3}",
    },
    priority: 49,
  },
  {
    name: "--settings",
    description:
      'The Python path to a settings module, e.g. "myproject.settings.main". If this isn\'t provided, the DJANGO_SETTINGS_MODULE environment variable will be used.',
    args: {
      name: "SETTINGS",
    },
    priority: 49,
  },
  {
    name: "--pythonpath",
    description:
      'A directory to add to the Python path, e.g. "/home/djangoprojects/myproject".',
    args: {
      name: "PYTHONPATH",
    },
    priority: 49,
  },
  {
    name: "--traceback",
    description: "Raise on CommandError exceptions",
    priority: 49,
  },
  {
    name: "--no-color",
    description: "Don't colorize the command output.",
    priority: 49,
  },
  {
    name: "--force-color",
    description: "Force colorization of the command output.",
    priority: 49,
  },
];

async function topLevelSubCommands(
  context: string[],
  executeShellCommand: Fig.ExecuteShellCommandFunction
): Promise<string[]> {
  let helpCommand;
  if (context.length > 0 && context[0] == "django-admin") {
    helpCommand = "django-admin help --skip-checks";
  } else {
    helpCommand = "python manage.py help --skip-checks";
  }
  const output = await executeShellCommand(`${helpCommand}`);
  console.log("top level output", output);
  const subcommands = output
    .split("\n")
    .filter((line) => line.startsWith("    "))
    .map((line) => line.trim());

  return subcommands;
}

// usage: manage.py check [-h] [--tag TAGS] [--list-tags] [--deploy]
//                        [--fail-level {CRITICAL,ERROR,WARNING,INFO,DEBUG}]
//                        [--database DATABASES] [--version] [-v {0,1,2,3}]
//                        [--settings SETTINGS] [--pythonpath PYTHONPATH]
//                        [--traceback] [--no-color] [--force-color]
//                        [app_label [app_label ...]]

// Checks the entire Django project for potential problems.

// positional arguments:
//   app_label

// optional arguments:
//   -h, --help            show this help message and exit
//   --tag TAGS, -t TAGS   Run only checks labeled with given tag.
//   --list-tags           List available tags.
//   --deploy              Check deployment settings.
//   --fail-level {CRITICAL,ERROR,WARNING,INFO,DEBUG}
//                         Message level that will cause the command to exit with
//                         a non-zero status. Default is ERROR.
//   --database DATABASES  Run database related checks against these aliases.
//   --version             show program's version number and exit
//   -v {0,1,2,3}, --verbosity {0,1,2,3}
//                         Verbosity level; 0=minimal output, 1=normal output,
//                         2=verbose output, 3=very verbose output
//   --settings SETTINGS   The Python path to a settings module, e.g.
//                         "project.settings.main". If this isn't provided, the
//                         DJANGO_SETTINGS_MODULE environment variable will be
//                         used.
//   --pythonpath PYTHONPATH
//                         A directory to add to the Python path, e.g.
//                         "/home/django-projects/project".
//   --traceback           Raise on CommandError exceptions
//   --no-color            Don't colorize the command output.
//   --force-color         Force colorization of the command output.

function separateOptionalArguments(lines: string[]): string[] {
  // TODO: Make sure everything is a single line string here

  // Maybe in here, we should already do some clean up especially for these multiline strings
  // We could trim the second line in stuff, so that it's not a mess later on.
  // If it's multiline, then each line after the first one is definitely part of the description

  let optionalArgsStartIndex: number;
  lines.forEach((line, index) => {
    if (line.startsWith("optional arguments:")) {
      optionalArgsStartIndex = index + 1;
    }
  });

  const options: string[] = [];

  const relevantLines = lines.slice(optionalArgsStartIndex);

  let currentOption: string | null = null;
  relevantLines.forEach((line, index) => {
    if (currentOption === null) {
      if (line.startsWith("  -")) {
        currentOption = line;
      }
    } else {
      if (!line.startsWith("  -")) {
        currentOption = [currentOption, line.trim()].join(" ");
      } else {
        // The line in the previous iteration was the last line of the optional argument
        options.push(currentOption);
        currentOption = line;
      }
    }

    const isLastIteration = index + 1 === relevantLines.length;
    if (isLastIteration) {
      options.push(currentOption);
    }
  });

  return options;
}

function parseOption(optionText: string): Fig.Option {
  const pattern = new RegExp(
    // prettier-ignore
    /^  (?<optionName>-{1,2}[\w-]+)(?: (?<argument>[A-Z_\[\]{},\d]+?))?(?:(?:, )*(?<optionAlternative>-{1,2}[\w-]+)+)?(?: (?<argument2>[A-Z_\[\]{},\d]+?))?\n? +(?<description>[\s\S]*)/
  );
  const match = optionText.match(pattern);
  const { optionName, optionAlternative, argument, description } = match.groups;

  let name: Fig.SingleOrArray<string> = optionName;
  if (optionAlternative) {
    name = [optionName, optionAlternative];
  }

  const option: Fig.Option = { name, description };

  if (argument) {
    option.args = {
      name: argument,
    };
  }

  if (
    ALWAYS_AVAILABLE_OPTIONS.includes(optionName) ||
    ALWAYS_AVAILABLE_OPTIONS.includes(optionAlternative)
  ) {
    option.priority = 49;
  }

  return option;
}

function separatePositionalArguments(lines: string[]): string[] {
  let positionalArgsStartIndex: number;
  lines.forEach((line, index) => {
    if (line.startsWith("positional arguments:")) {
      positionalArgsStartIndex = index + 1;
    }
  });

  let relevantLines = lines.slice(positionalArgsStartIndex);

  let positionalArgsEndIndex: number;

  relevantLines.forEach((line, index) => {
    if (line === "\n") {
      positionalArgsEndIndex = index;
    }

    if (
      positionalArgsEndIndex === undefined &&
      line === "optional arguments:"
    ) {
      positionalArgsEndIndex = index - 1;
    }
  });

  if (positionalArgsEndIndex === undefined) {
    positionalArgsEndIndex = relevantLines.length - 1;
  }

  relevantLines = relevantLines.slice(0, positionalArgsEndIndex);
  console.log("args full relevant lines", relevantLines);

  const args: string[] = [];

  const pattern = /^  \w/;

  let currentArgument: string | null = null;
  relevantLines.forEach((line, index) => {
    console.log("relevant line for args", line, index);
    if (currentArgument === null) {
      if (pattern.test(line)) {
        console.log("setting line");
        currentArgument = line;
      }
    } else {
      if (!pattern.test(line)) {
        console.log("joining with previous line");
        currentArgument = [currentArgument, line].join(" ");
      } else {
        // The line in the previous iteration was the last line of the argument
        console.log("pushing previous and setting new line");
        args.push(currentArgument);
        currentArgument = line;
      }
    }
    const isLastIteration = index + 1 === relevantLines.length;
    if (isLastIteration) {
      console.log("pushing final argument");
      args.push(currentArgument);
    }
  });

  console.log("arg lines", args);

  return args;
}

function parseArg(argument: string): Fig.Arg {
  const pattern = /(?<name>[\w_-]+) *(?<description>.*)/;
  const match = argument.match(pattern);
  const { name, description } = match.groups;

  const arg: Fig.Arg = {
    name,
    description,
    // TODO: Improve parsing to detect whether argument is optional or not
    // TODO: Improve parsing to detect whether argument is variadic or not
    isOptional: true,
  };

  return arg;
}

function parseSubCommandDescription(helpOutput: string): string {
  // TODO: Some commands like remove_stale_contenttypes
  // don't actually have a description. Currently this function fails for those
  // commands.
  const pattern = /usage:[\s\S]+?\n(?<description>^\w.*)/m;

  return helpOutput?.match(pattern)?.groups?.description;
}

function parseSubcommandHelpOutput(
  name: string,
  helpOutput: string
): Fig.Subcommand {
  const lines = helpOutput.split("\n");

  let startIndex: number;
  lines.forEach((line, index) => {
    if (line.startsWith("usage: ")) {
      startIndex = index;
    }
  });

  const cleanedLines = lines.filter((line, index) => index >= startIndex);

  const separatedOptionalArguments = separateOptionalArguments(cleanedLines);

  const options = separatedOptionalArguments
    .map(parseOption)
    // Temporary for data gathering
    .filter((option) => option.priority === undefined);

  const description = parseSubCommandDescription(helpOutput);

  const args = separatePositionalArguments(cleanedLines)
    .filter(Boolean)
    .map((line) => line.trim())
    .map(parseArg);

  console.log("args for", name, args);

  return { name, icon: DJANGO_ICON_URL, options, description, args };
}

async function subCommandSpec(
  subcommand: string,
  context: string[],
  executeShellCommand: Fig.ExecuteShellCommandFunction
): Promise<Fig.Spec> {
  let helpCommand;
  if (context.length > 0 && context[0] == "django-admin") {
    helpCommand = "django-admin help";
  } else {
    helpCommand = "python manage.py help";
  }

  const helpOutput = await executeShellCommand(`${helpCommand} ${subcommand}`);

  // Make this a single line return again
  const output = parseSubcommandHelpOutput(subcommand, helpOutput);
  log(context, output);

  return output;
}

async function allSubCommands(
  context: string[],
  executeShellCommand: Fig.ExecuteShellCommandFunction
): Promise<Fig.Spec> {
  const rawSubCommands = await topLevelSubCommands(
    context,
    executeShellCommand
  );
  const subcommands: Fig.Subcommand[] = rawSubCommands.map((subcommand) => ({
    name: subcommand,
    icon: DJANGO_ICON_URL,
    generateSpec: async (context, executeShellCommand) =>
      subCommandSpec(subcommand, context, executeShellCommand),
  }));
  // log(context, {
  //   name: "django-admin",
  //   icon: DJANGO_ICON_URL,
  //   subcommands,
  // });

  return {
    name: "django-admin",
    icon: DJANGO_ICON_URL,
    subcommands,
    // TODO: There are several top level args that we should add here. verbosity, version, etc.
    args: {},
  };
}

const DJANGO_NATIVE_COMMANDS: Fig.Subcommand[] = [
  {
    name: "changepassword",
    icon: DJANGO_ICON_URL,
    options: [
      ...FULL_ALWAYS_AVAILABLE_OPTIONS,
      {
        name: "--database",
        description: 'Specifies the database to use. Default is "default".',
        args: {
          name: "DATABASE",
        },
      },
    ],
    description: "Change a user's password for django.contrib.auth.",
    args: [
      {
        name: "username",
        description:
          "Username to change password for; by default, it's the current username.",
        isOptional: true,
      },
    ],
  },
  {
    name: "createsuperuser",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--username",
        description: "Specifies the login for the superuser.",
        args: {
          name: "USERNAME",
        },
      },
      {
        name: ["--noinput", "--no-input"],
        description: "Tells Django to NOT prompt the user for input of any",
      },
      {
        name: "--database",
        description: 'Specifies the database to use. Default is "default".',
        args: {
          name: "DATABASE",
        },
      },
      {
        name: "--email",
        description: "Specifies the email for the superuser.",
        args: {
          name: "EMAIL",
        },
      },
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
    description: "Used to create a superuser.",
  },
  {
    name: "remove_stale_contenttypes",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: ["--noinput", "--no-input"],
        description: "Tells Django to NOT prompt the user for input of any",
      },
      {
        name: "--database",
        description: "Nominates the database to use. Defaults to the",
        args: {
          name: "DATABASE",
        },
      },
      {
        name: "--include-stale-apps",
        description: "Deletes stale content types including ones from",
      },
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
  },
  {
    name: "check",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: ["--tag", "-t"],
        description: "Run only checks labeled with given tag.",
        args: {
          name: "TAGS",
        },
      },
      {
        name: "--list-tags",
        description: "List available tags.",
      },
      {
        name: "--deploy",
        description: "Check deployment settings.",
      },
      {
        name: "--fail-level",
        description: "Message level that will cause the command to exit with",
        args: {
          name: "{CRITICAL,ERROR,WARNING,INFO,DEBUG}",
        },
      },
      {
        name: "--database",
        description: "Run database related checks against these aliases.",
        args: {
          name: "DATABASES",
        },
      },
    ],
    description: "Checks the entire Django project for potential problems.",
    args: [
      {
        name: "app_label",
        variadic: true,
        isOptional: true,
      },
    ],
  },
  {
    name: "compilemessages",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: ["--locale", "-l"],
        description: "Locale(s) to process (e.g. de_AT). Default is to",
        args: {
          name: "LOCALE",
        },
      },
      {
        name: ["--exclude", "-x"],
        description: "Locales to exclude. Default is none. Can be used",
        args: {
          name: "EXCLUDE",
        },
      },
      {
        name: ["--use-fuzzy", "-f"],
        description: "Use fuzzy translations.",
      },
      {
        name: ["--ignore", "-i"],
        description: "Ignore directories matching this glob-style pattern.",
        args: {
          name: "PATTERN",
        },
      },
    ],
    description:
      "Compiles .po files to .mo files for use with builtin gettext support.",
  },
  {
    name: "createcachetable",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--database",
        description: "Nominates a database onto which the cache tables will",
        args: {
          name: "DATABASE",
        },
      },
      {
        name: "--dry-run",
        description: "Does not create the table, just prints the SQL that",
      },
    ],
    description: "Creates the tables needed to use the SQL cache backend.",
    args: [
      {
        name: "table_name",
        description:
          "Optional table names. Otherwise, settings.CACHES is used to find cache tables.",
        variadic: true,
        isOptional: true,
      },
    ],
  },
  {
    name: "dbshell",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--database",
        description: "Nominates a database onto which to open a shell.",
        args: {
          name: "DATABASE",
        },
      },
    ],
    description:
      "Runs the command-line client for specified database, or the default database",
  },
  {
    name: "diffsettings",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--all",
        description: "Display all settings, regardless of their value. In",
      },
      {
        name: "--default",
        description: "The settings module to compare the current settings",
        args: {
          name: "MODULE",
        },
      },
      {
        name: "--output",
        description: "{hash,unified}",
      },
    ],
    description:
      "Displays differences between the current settings.py and Django's default",
  },
  {
    name: "dumpdata",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--format",
        description: "Specifies the output serialization format for fixtures.",
        args: {
          name: "FORMAT",
        },
      },
      {
        name: "--indent",
        description:
          "Specifies the indent level to use when pretty-printing output.",
        args: {
          name: "INDENT",
        },
      },
      {
        name: "--database",
        description:
          'Nominates a specific database to dump fixtures from. Defaults to the "default" database.',
        args: {
          name: "DATABASE",
        },
      },
      {
        name: ["-e", "--exclude"],
        description:
          "An app_label or app_label.ModelName to exclude (use multiple --exclude to exclude multiple apps/models).",
        args: {
          name: "EXCLUDE",
        },
      },
      {
        name: "--natural-foreign",
        description: "Use natural foreign keys if they are available.",
      },
      {
        name: "--natural-primary",
        description: "Use natural primary keys if they are available.",
      },
      {
        name: ["-a", "--all"],
        description:
          "Use Django's base manager to dump all models stored in the database, including those that would otherwise be filtered or modified by a custom manager.",
      },
      {
        name: "--pks",
        description:
          "Only dump objects with given primary keys. Accepts a comma-separated list of keys. This option only works when you specify one model.",
        args: {
          name: "PRIMARY_KEYS",
        },
      },
      {
        name: ["-o", "--output"],
        description: "Specifies file to which the output is written.",
        args: {
          name: "OUTPUT",
        },
      },
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
    description:
      "Output the contents of the database as a fixture of the given format (using each model's default manager unless --all is specified).",
    args: [
      {
        name: "app_label",
        description:
          "Restricts dumped data to the specified app_label or app_label.ModelName.",
        isOptional: true,
        variadic: true,
      },
    ],
  },
  {
    name: "flush",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: ["--noinput", "--no-input"],
        description:
          "Tells Django to NOT prompt the user for input of any kind.",
      },
      {
        name: "--database",
        description:
          'Nominates a database to flush. Defaults to the "default" database.',
        args: {
          name: "DATABASE",
        },
      },
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
    description:
      "Removes ALL DATA from the database, including data added during migrations.",
  },
  {
    name: "inspectdb",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--database",
        description:
          'Nominates a database to introspect. Defaults to using the "default" database.',
        args: {
          name: "DATABASE",
        },
      },
      {
        name: "--include-partitions",
        description: "Also output models for partition tables.",
      },
      {
        name: "--include-views",
        description: "Also output models for database views.",
      },
    ],
    description:
      "Introspects the database tables in the given database and outputs a Django",
    args: [
      {
        name: "table",
        description: "Selects what tables or views should be introspected.",
        isOptional: true,
        variadic: true,
      },
    ],
  },
  {
    name: "loaddata",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--database",
        description:
          'Nominates a specific database to load fixtures into. Defaults to the "default" database.',
        args: {
          name: "DATABASE",
        },
      },
      {
        name: "--app",
        description: "Only look for fixtures in the specified app.",
        args: {
          name: "APP_LABEL",
        },
      },
      {
        name: ["--ignorenonexistent", "-i"],
        description:
          "Ignores entries in the serialized data for fields that do not currently exist on the model.",
      },
      {
        name: ["-e", "--exclude"],
        description:
          "An app_label or app_label.ModelName to exclude. Can be used multiple times.",
        args: {
          name: "EXCLUDE",
        },
      },
      {
        name: "--format",
        description: "Format of serialized data when reading from stdin.",
        args: {
          name: "FORMAT",
        },
      },
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
    description: "Installs the named fixture(s) in the database.",
    args: [
      {
        name: "fixture",
        description: "Fixture labels.",
        isOptional: false,
        variadic: true,
      },
    ],
  },
  {
    name: "makemessages",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: ["--locale", "-l"],
        description:
          "Creates or updates the message files for the given locale(s) (e.g. pt_BR). Can be used multiple times.",
        args: {
          name: "LOCALE",
        },
      },
      {
        name: ["--exclude", "-x"],
        description:
          "Locales to exclude. Default is none. Can be used multiple times.",
        args: {
          name: "EXCLUDE",
        },
      },
      {
        name: ["--domain", "-d"],
        description: 'The domain of the message files (default: "django").',
        args: {
          name: "DOMAIN",
        },
      },
      {
        name: ["--all", "-a"],
        description: "Updates the message files for all existing locales.",
      },
      {
        name: ["--extension", "-e"],
        description:
          'The file extension(s) to examine (default: "html,txt,py", or "js" if the domain is "djangojs"). Separate multiple extensions with commas, or use -e multiple times.',
        args: {
          name: "EXTENSIONS",
        },
      },
      {
        name: ["--symlinks", "-s"],
        description:
          "Follows symlinks to directories when examining source code and templates for translation strings.",
      },
      {
        name: ["--ignore", "-i"],
        description:
          "Ignore files or directories matching this glob-style pattern. Use multiple times to ignore more.",
        args: {
          name: "PATTERN",
        },
      },
      {
        name: "--no-default-ignore",
        description:
          "Don't ignore the common glob-style patterns 'CVS', '.*', '*~' and '*.pyc'.",
      },
      {
        name: "--no-wrap",
        description: "Don't break long message lines into several lines.",
      },
      {
        name: "--no-location",
        description: "Don't write '#: filename:line' lines.",
      },
      {
        name: "--add-location",
        description:
          "[{full,file,never}] Controls '#: filename:line' lines. If the option is 'full' (the default if not given), the lines include both file name and line number. If it's 'file', the line number is omitted. If it's 'never', the lines are suppressed (same as --no-location). --add-location requires gettext 0.19 or newer.",
      },
      {
        name: "--no-obsolete",
        description: "Remove obsolete message strings.",
      },
      {
        name: "--keep-pot",
        description:
          "Keep .pot file after making messages. Useful when debugging.",
      },
    ],
    description:
      "Runs over the entire source tree of the current directory and pulls out all strings marked for translation. It creates (or updates) a message file in the conf/locale (in the django tree) or locale (for projects and applications) directory. You must run this command with one of either the --locale, --exclude, or --all options.",
  },
  {
    name: "makemigrations",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--dry-run",
        description:
          "Just show what migrations would be made; don't actually write them.",
      },
      {
        name: "--merge",
        description: "Enable fixing of migration conflicts.",
      },
      {
        name: "--empty",
        description: "Create an empty migration.",
      },
      {
        name: ["--noinput", "--no-input"],
        description:
          "Tells Django to NOT prompt the user for input of any kind.",
      },
      {
        name: ["-n", "--name"],
        description: "Use this name for migration file(s).",
        args: {
          name: "NAME",
        },
      },
      {
        name: "--no-header",
        description: "Do not add header comments to new migration file(s).",
      },
      {
        name: "--check",
        description:
          "Exit with a non-zero status if model changes are missing migrations.",
      },
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
    description: "Creates new migration(s) for apps.",
    args: [
      {
        name: "app_label",
        description: "Specify the app label(s) to create migrations for.",
        isOptional: true,
        variadic: true,
      },
    ],
  },
  {
    name: "migrate",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: ["--noinput", "--no-input"],
        description:
          "Tells Django to NOT prompt the user for input of any kind.",
      },
      {
        name: "--database",
        description:
          'Nominates a database to synchronize. Defaults to the "default" database.',
        args: {
          name: "DATABASE",
        },
      },
      {
        name: "--fake",
        description: "Mark migrations as run without actually running them.",
      },
      {
        name: "--fake-initial",
        description:
          "Detect if tables already exist and fake-apply initial migrations if so. Make sure that the current database schema matches your initial migration before using this flag. Django will only check for an existing table name.",
      },
      {
        name: "--plan",
        description:
          "Shows a list of the migration actions that will be performed.",
      },
      {
        name: "--run-syncdb",
        description: "Creates tables for apps without migrations.",
      },
      {
        name: "--check",
        description:
          "Exits with a non-zero status if unapplied migrations exist.",
      },
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
    description:
      "Updates database schema. Manages both apps with migrations and those without.",
    args: [
      {
        name: "app_label",
        description: "App label of an application to synchronize the state.",
        isOptional: true,
      },
      {
        name: "migration_name",
        description:
          'Database state will be brought to the state after that migration. Use the name "zero" to unapply all migrations.',
        isOptional: true,
      },
    ],
  },
  {
    name: "sendtestemail",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--managers",
        description:
          "Send a test email to the addresses specified in settings.MANAGERS.",
      },
      {
        name: "--admins",
        description:
          "Send a test email to the addresses specified in settings.ADMINS.",
      },
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
    description:
      "Sends a test email to the email addresses specified as arguments.",
    args: [
      {
        name: "email",
        description: "One or more email addresses to send a test email to.",
        isOptional: true,
        variadic: true,
      },
    ],
  },
  {
    name: "shell",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--no-startup",
        description:
          "When using plain Python, ignore the PYTHONSTARTUP environment variable and ~/.pythonrc.py script.",
      },
      {
        name: ["-i", "--interface"],
        description:
          '{ipython,bpython,python}, --interface {ipython,bpython,python} Specify an interactive interpreter interface. Available options: "ipython", "bpython", and "python"',
        args: {
          name: "{ipython,bpython,python}",
        },
      },
      {
        name: ["-c", "--command"],
        description:
          "Instead of opening an interactive shell, run a command as Django and exit.",
        args: {
          name: "COMMAND",
        },
      },
    ],
    description:
      "Runs a Python interactive interpreter. Tries to use IPython or bpython, if one of them is available. Any standard input is executed as code.",
  },
  {
    name: "showmigrations",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--database",
        description:
          'Nominates a database to synchronize. Defaults to the "default" database.',
        args: {
          name: "DATABASE",
        },
      },
      {
        name: ["--list", "-l"],
        description:
          "Shows a list of all migrations and which are applied. With a verbosity level of 2 or above, the applied datetimes will be included.",
      },
      {
        name: ["--plan", "-p"],
        description:
          "Shows all migrations in the order they will be applied. With a verbosity level of 2 or above all direct migration dependencies and reverse dependencies (run_before) will be included.",
      },
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
    description: "Shows all available migrations for the current project",
    args: [
      {
        name: "app_label",
        description: "App labels of applications to limit the output to.",
        isOptional: true,
        variadic: true,
      },
    ],
  },
  {
    name: "sqlflush",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--database",
        description:
          'Nominates a database to print the SQL for. Defaults to the "default" database.',
        args: {
          name: "DATABASE",
        },
      },
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
    description:
      "Returns a list of the SQL statements required to return all tables in the database to the state they were in just after they were installed.",
  },
  {
    name: "sqlmigrate",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--database",
        description:
          'Nominates a database to create SQL for. Defaults to the "default" database.',
        args: {
          name: "DATABASE",
        },
      },
      {
        name: "--backwards",
        description:
          "Creates SQL to unapply the migration, rather than to apply it",
      },
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
    description: "Prints the SQL statements for the named migration.",
    args: [
      {
        name: "app_label",
        description: "App label of the application containing the migration.",
        isOptional: false,
      },
      {
        name: "migration_name",
        description: "Migration name to print the SQL for.",
        isOptional: false,
      },
    ],
  },
  {
    name: "sqlsequencereset",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--database",
        description:
          'Nominates a database to print the SQL for. Defaults to the "default" database.',
        args: {
          name: "DATABASE",
        },
      },
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
    description:
      "Prints the SQL statements for resetting sequences for the given app name(s).",
    args: [
      {
        name: "app_label",
        description: "One or more application label.",
        variadic: true,
        isOptional: false,
      },
    ],
  },
  {
    name: "squashmigrations",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--no-optimize",
        description: "Do not try to optimize the squashed operations.",
      },
      {
        name: ["--noinput", "--no-input"],
        description:
          "Tells Django to NOT prompt the user for input of any kind.",
      },
      {
        name: "--squashed-name",
        description: "Sets the name of the new squashed migration.",
        args: {
          name: "SQUASHED_NAME",
        },
      },
      {
        name: "--no-header",
        description:
          "Do not add a header comment to the new squashed migration.",
      },
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
    description:
      "Squashes an existing set of migrations (from first until specified) into a single new one.",
    args: [
      {
        name: "app_label",
        description: "App label of the application to squash migrations for.",
        isOptional: false,
      },
      {
        name: "start_migration_name",
        description:
          "Migrations will be squashed starting from and including this migration.",
        isOptional: true,
      },
      {
        name: "migration_name",
        description:
          "Migrations will be squashed until and including this migration.",
        isOptional: false,
      },
    ],
  },
  {
    name: "startapp",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--template",
        description: "The path or URL to load the template from.",
        args: {
          name: "TEMPLATE",
        },
      },
      {
        name: ["--extension", "-e"],
        description:
          'The file extension(s) to render (default: "py"). Separate multiple extensions with commas, or use -e multiple times.',
        args: {
          name: "EXTENSIONS",
        },
      },
      {
        name: ["--name", "-n"],
        description:
          "The file name(s) to render. Separate multiple file names with commas, or use -n multiple times.",
        args: {
          name: "FILES",
        },
      },
    ],
    description:
      "Creates a Django app directory structure for the given app name in the current directory or optionally in the given directory.",
    args: [
      {
        name: "name",
        description: "Name of the application or project.",
        isOptional: false,
      },
      {
        name: "directory",
        description: "Optional destination directory",
        isOptional: true,
      },
    ],
  },
  {
    name: "startproject",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--template",
        description: "The path or URL to load the template from.",
        args: {
          name: "TEMPLATE",
        },
      },
      {
        name: ["--extension", "-e"],
        description:
          'The file extension(s) to render (default: "py"). Separate multiple extensions with commas, or use -e multiple times.',
        args: {
          name: "EXTENSIONS",
        },
      },
      {
        name: ["--name", "-n"],
        description:
          "The file name(s) to render. Separate multiple file names with commas, or use -n multiple times.",
        args: {
          name: "FILES",
        },
      },
    ],
    description:
      "Creates a Django project directory structure for the given project name in the current directory or optionally in the given directory.",
    args: [
      {
        name: "name",
        description: "Name of the application or project.",
        isOptional: false,
      },
      {
        name: "directory",
        description: "Optional destination directory",
        isOptional: true,
      },
    ],
  },
  {
    name: "test",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: ["--noinput", "--no-input"],
        description:
          "Tells Django to NOT prompt the user for input of any kind.",
      },
      {
        name: "--failfast",
        description:
          "Tells Django to stop running the test suite after first failed test.",
      },
      {
        name: "--testrunner",
        description:
          "Tells Django to use specified test runner class instead of the one specified by the TEST_RUNNER setting.",
        args: {
          name: "TESTRUNNER",
        },
      },
      {
        name: ["-t", "--top-level-directory"],
        description: "Top level of project for unittest discovery.",
        args: {
          name: "TOP_LEVEL",
        },
      },
      {
        name: ["-p", "--pattern"],
        description: "The test matching pattern. Defaults to test*.py.",
        args: {
          name: "PATTERN",
        },
      },
      {
        name: "--keepdb",
        description: "Preserves the test DB between runs.",
      },
      {
        name: ["-r", "--reverse"],
        description: "Reverses test cases order.",
      },
      {
        name: "--debug-mode",
        description: "Sets settings.DEBUG to True.",
      },
      {
        name: ["-d", "--debug-sql"],
        description: "Prints logged SQL queries on failure.",
      },
      {
        name: "--parallel",
        description: "Run tests using up to N parallel processes.",
        args: {
          name: "[N]",
        },
      },
      {
        name: "--tag",
        description:
          "Run only tests with the specified tag. Can be used multiple times.",
        args: {
          name: "TAGS",
        },
      },
      {
        name: "--exclude-tag",
        description:
          "Do not run tests with the specified tag. Can be used multiple times.",
        args: {
          name: "EXCLUDE_TAGS",
        },
      },
      {
        name: "--pdb",
        description:
          "Runs a debugger (pdb, or ipdb if installed) on error or failure.",
      },
      {
        name: ["-b", "--buffer"],
        description: "Discard output from passing tests.",
      },
      {
        name: "-k",
        description:
          "Only run test methods and classes that match the pattern or substring. Can be used multiple times. Same as unittest -k option.",
        args: {
          name: "TEST_NAME_PATTERNS",
        },
      },
    ],
    description:
      "Discover and run tests in the specified modules or the current directory.",
    args: [
      {
        name: "test_label",
        description:
          "Module paths to test; can be modulename, modulename.TestCase or modulename.TestCase.test_method",
        isOptional: true,
      },
    ],
  },
  {
    name: "testserver",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: ["--noinput", "--no-input"],
        description:
          "Tells Django to NOT prompt the user for input of any kind.",
      },
      {
        name: "--addrport",
        description: "Port number or ipaddr:port to run the server on.",
        args: {
          name: "ADDRPORT",
        },
      },
      {
        name: ["--ipv6", "-6"],
        description: "Tells Django to use an IPv6 address.",
      },
    ],
    description:
      "Runs a development server with data from the given fixture(s).",
    args: [
      {
        name: "fixture",
        description: "Path(s) to fixtures to load before running the server.",
        isOptional: true,
      },
    ],
  },
  {
    name: "test_mail",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
  },
  {
    name: "clearsessions",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
    description:
      "Can be run as a cronjob or directly to clean out expired sessions (only with the database backend at the moment).",
  },
  {
    name: "collectstatic",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: ["--noinput", "--no-input"],
        description: "Do NOT prompt the user for input of any kind.",
      },
      {
        name: "--no-post-process",
        description: "Do NOT post process collected files.",
      },
      {
        name: ["-i", "--ignore"],
        description:
          "Ignore files or directories matching this glob-style pattern. Use multiple times to ignore more.",
        args: {
          name: "PATTERN",
        },
      },
      {
        name: ["-n", "--dry-run"],
        description: "Do everything except modify the filesystem.",
      },
      {
        name: ["-c", "--clear"],
        description:
          "Clear the existing files using the storage before trying to copy or link the original file.",
      },
      {
        name: ["-l", "--link"],
        description: "Create a symbolic link to each file instead of copying.",
      },
      {
        name: "--no-default-ignore",
        description:
          "Don't ignore the common private glob-style patterns (defaults to 'CVS', '.*' and '*~').",
      },
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
    description: "Collect static files in a single location.",
  },
  {
    name: "findstatic",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: "--first",
        description: "Only return the first match for each static file.",
      },
      {
        name: "--skip-checks",
        description: "Skip system checks.",
      },
    ],
    description: "Finds the absolute paths for the given static file(s).",
    args: [
      {
        name: "staticfile",
        variadic: true,
      },
    ],
  },
  {
    name: "runserver",
    icon: DJANGO_ICON_URL,
    options: [
      {
        name: ["--ipv6", "-6"],
        description: "Tells Django to use an IPv6 address.",
      },
      {
        name: "--nothreading",
        description: "Tells Django to NOT use threading.",
      },
      {
        name: "--noreload",
        description: "Tells Django to NOT use the auto-reloader.",
      },
      {
        name: "--nostatic",
        description:
          "Tells Django to NOT automatically serve static files at STATIC_URL.",
      },
      {
        name: "--insecure",
        description: "Allows serving static files even if DEBUG is False.",
      },
    ],
    description:
      "Starts a lightweight Web server for development and also serves static files.",
    args: [
      {
        name: "addrport",
        description: "Optional port number, or ipaddr:port",
        isOptional: true,
      },
    ],
  },
];

export const completion: Fig.Spec = {
  name: "django-admin",
  description: "Utility script for the Django Web framework",
  icon: DJANGO_ICON_URL,
  // generateSpec: allSubCommands,
  subcommands: [
    {
      name: "help",
      description: "Usage and help information for django-admin",
      icon: DJANGO_ICON_URL,
      // generateSpec: async (context, executeShellCommand) => {
      //   const subcommands = await topLevelSubCommands(
      //     context,
      //     executeShellCommand
      //   );
      //   log(context, subcommands);
      //   return {
      //     name: "help",
      //     subcommands: subcommands.map((subcommand) => ({
      //       name: subcommand,
      //       icon: DJANGO_ICON_URL,
      //     })),
      //   };
      // },
      subcommands: DJANGO_NATIVE_COMMANDS.filter(
        (command) => command.name != "help"
      ).map((command) => ({
        name: command.name,
        icon: DJANGO_ICON_URL,
      })),
    },
    ...DJANGO_NATIVE_COMMANDS,
  ],
  options: [],
};

// More notes:
// - for some reason "version" isn't documented as a top level command?

// For the future:
// - Attempt to do an app name generator where that seems possible
// - Make this more dynamic again.
//    - Need fig to copy over $PATH automatically
//    - Need everything to be faster or merging + duplication
// - Tests for the code in here
