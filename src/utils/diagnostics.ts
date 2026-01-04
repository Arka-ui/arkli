import { execa } from 'execa';
import { log } from './logger.js';
import { IS_LINUX } from './system.js';
import chalk from 'chalk';

export interface ServiceDiagnosis {
    service: string;
    status: string;
    logs: string;
    suggestion?: string;
}

export const checkServiceStatus = async (service: string): Promise<string> => {
    if (!IS_LINUX) return 'active (simulated)';
    try {
        const { stdout } = await execa('systemctl', ['is-active', service]);
        return stdout.trim();
    } catch (e) {
        return 'inactive/failed';
    }
};

export const getServiceLogs = async (service: string, lines = 50): Promise<string> => {
    if (!IS_LINUX) return '(Simulation) No real logs available on Windows.';
    try {
        // -n: number of lines, --no-pager: plain text output
        const { stdout } = await execa('sudo', ['journalctl', '-xeu', service, '-n', lines.toString(), '--no-pager']);
        return stdout;
    } catch (e: any) {
        return `Failed to fetch logs: ${e.message}`;
    }
};

export const diagnoseServiceFailure = async (service: string): Promise<ServiceDiagnosis> => {
    log.info(`Diagnosing failure for service: ${chalk.yellow(service)}...`);

    const status = await checkServiceStatus(service);
    const logs = await getServiceLogs(service);

    let suggestion: string | undefined;

    // Basic heuristic analysis
    if (logs.includes('Address already in use')) {
        suggestion = 'Port conflict detected. Check if another service is using the mail ports (25, 143, 587, 993).';
    } else if (logs.includes('Permission denied')) {
        suggestion = 'Permission error. Check file ownership of configuration files or SSL certs.';
    } else if (logs.includes('SSL configuration error') || logs.includes('No such file or directory')) {
        suggestion = 'SSL/TLS Certificate missing or invalid path. Ensure Certbot ran successfully.';
    } else if (logs.includes('syntax error')) {
        suggestion = 'Configuration syntax error. The generated config file might have a typo.';
    }

    return { service, status, logs, suggestion };
};

export const printDiagnosis = (diagnosis: ServiceDiagnosis) => {
    console.log(chalk.red('\n=== SERVICE FAILURE DIAGNOSIS ==='));
    console.log(`${chalk.bold('Service:')} ${diagnosis.service}`);
    console.log(`${chalk.bold('Status:')}  ${diagnosis.status}`);
    console.log(chalk.red('--- Recent Logs ---'));
    console.log(diagnosis.logs);
    console.log(chalk.red('-------------------'));

    if (diagnosis.suggestion) {
        console.log(`${chalk.green.bold('💡 AUTO-FIX SUGGESTION:')} ${diagnosis.suggestion}`);
    } else {
        console.log(chalk.yellow('No specific auto-fix found. Please review the logs above.'));
    }
    console.log('=================================\n');
};
