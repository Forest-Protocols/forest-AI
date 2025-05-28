import { homedir } from "os";
import { dirname, join } from "path";

/**
 * Paths to configuration files/directories
 */
export class ConfigPath {
  /**
   * Directory path of where the config.json stored in.
   * @default "<directory of the config file>"
   */
  static get configDirPath() {
    return dirname(ConfigPath.configFilePath);
  }

  /**
   * Directory path of where the XMTP database files are stored.
   * @default "<config dir path>/xmtp"
   */
  static get xmtpDirPath() {
    return join(ConfigPath.configDirPath, "xmtp");
  }

  /**
   * Imported API spec path (it's under config directory)
   * @default "<config dir path>/specs"
   */
  static get apiSpecDirPath() {
    return join(ConfigPath.configDirPath, "specs");
  }

  /**
   * Path of the main configuration file (config.json).
   * It can be changed via `FOREST_CONFIG` env variable.
   * @default "<home dir>/.forest/config.json"
   */
  static get configFilePath() {
    return (
      process.env.FOREST_CONFIG || join(homedir(), ".forest", "config.json")
    );
  }
}
