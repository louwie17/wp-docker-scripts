const yaml = require("js-yaml");
const fs = require("fs");
const generateInstallScript = require("./make-install");

const INSTALL_SCRIPT_FILENAME = "wp-install-dynamic.sh";

const generateConfig = () => {
  const config = getConfig();
  const wordpressEnvironment =  {
          WORDPRESS_DB_HOST: `${config.CONTAINER_NAME_PREFIX}_db`, // "db",
          WORDPRESS_DB_USER: "root",
          WORDPRESS_DB_PASSWORD: "root",
          WORDPRESS_DB_NAME: "wp_db",
  };

  const mappings = config.mappings
    ? Object.entries(config.mappings).map(([target, source]) => {
        const mappingTarget = target === "/" ? '/var/www/html' : `/var/www/html/${target}`;
        return {
          type: "bind",
          source,
          target: mappingTarget,
        };
      })
    : [];
  
  if (config.multiSite) {
    if (config.WP_PORT !== 80) {
      console.error(`Multisite requires port 80, WP_PORT is set to ${config.WP_PORT}.`);
      process.exit(1);
    }
    const domain = config.WP_HOST_NAME.replace('http://', '');
    wordpressEnvironment['WORDPRESS_CONFIG_EXTRA'] = `
        /* Multisite */
        define('WP_ALLOW_MULTISITE', true );
        define('MULTISITE', true);
        define('SUBDOMAIN_INSTALL', false);
        define('DOMAIN_CURRENT_SITE', '${domain}');
        define('PATH_CURRENT_SITE', '/');
        define('SITE_ID_CURRENT_SITE', 1);
        define('BLOG_ID_CURRENT_SITE', 1);
    `;
    mappings.push({
     type: "bind",
     source: __dirname + '/docker/wordpress/multisite.htaccess',
     target: `/var/www/html/.htaccess`, 
    })
  }

  if ( mappings.findIndex(s => s.target === '/var/www/html') === -1 ) {
    mappings.push({
            type: "volume",
            source: "wp_data",
            target: "/var/www/html",
          });
  }

  let wpHostName = config.WP_HOST_NAME;
  if (config.WP_PORT !== 80) {
     wpHostName += `:${config.WP_PORT}`;
  }

  return {
    version: "3.8",
    services: {
      wordpress: {
        container_name: `${config.CONTAINER_NAME_PREFIX}_wordpress`,
        // image: "wordpress_debug:latest",
        restart: "always",
        ports: [`${config.WP_PORT}:80`],
        build: {
          context: './docker',
          dockerfile: './wordpress/Dockerfile',
          args: {
            enablexdebug: config.enableXDebug ? 1 : 0
          },
        },
        environment: {
          ...wordpressEnvironment
        },
        volumes: [
          ...mappings,
        ],
        depends_on: ["db"],
        networks: [ "default" , "woocommerce" ]
        // networks: {
        //   default: {
        //     aliases:[ "woocommerce.test" ]
        //   }
        // }
      },
      db: {
        container_name: `${config.CONTAINER_NAME_PREFIX}_db`,
        image: "mysql:8.0",
        platform: "linux/amd64",
        restart: "always",
        ports: ["3306:3306"],
        environment: {
          MYSQL_DATABASE: "wp_db",
          MYSQL_USER: "user",
          MYSQL_PASSWORD: "password",
          MYSQL_ROOT_PASSWORD: "root",
        },
        // networks: {
        //   default: {
        //     aliases:[ "wp_db" ]
        //   }
        // },
        volumes: ["db:/var/lib/mysql"],
      },
      "wordpress-cli": {
        container_name: `${config.CONTAINER_NAME_PREFIX}_cli`,
        depends_on: ["db", "wordpress"],
        image: "wordpress_installer:latest",
        environment: {
          WP_HOST_NAME: wpHostName,
          WORDPRESS_DB_HOST: "db",
          WORDPRESS_DB_USER: "root",
          WORDPRESS_DB_PASSWORD: "root",
          WORDPRESS_DB_NAME: "wp_db",
        },
        user: "xfs",
        command: `/usr/local/bin/${INSTALL_SCRIPT_FILENAME}`,
        volumes: [
          ...mappings
        ],
        // networks: {
        //   default: {
        //     aliases:[ "wp_dev_cli" ]
        //   }
        // }
      },
    },
    volumes: {
      db: null,
      wp_data: null,
    },
    networks: {
      // default: {
      //   name: "wp_dev"
      // },
      woocommerce: {
        external: true,
        name: 'woocommerce.test'
      }
    }
  };
};

const getConfig = () => {
  const config = require("./config.js");

  if (!config) {
    throw new Error("Could not find config.js");
  }

  return {
    CONTAINER_NAME_PREFIX: "wp_dev",
    WP_HOST_NAME: "http://docker.for.mac.localhost",
    WP_PORT: 1234,
    ...config,
  };
};

const generateYamlConfig = () => {
  return yaml.dump(generateConfig());
};

const generateCompose = () => {
  // generate the dynamic install script
  generateInstall();

  fs.writeFileSync("dynamic-compose.yml", generateYamlConfig(), {
    encoding: "utf8",
    flag: "w",
  });
};

const generateInstall = () => {
  fs.writeFileSync(
    `docker/${INSTALL_SCRIPT_FILENAME}`,
    generateInstallScript(getConfig()),
    {
      encoding: "utf8",
      flag: "w",
    }
  );

  fs.chmodSync(`docker/${INSTALL_SCRIPT_FILENAME}`, "755");
};

generateCompose();
