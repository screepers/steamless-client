import chalk from 'chalk';

export const error = (...args: unknown[]) => console.error('❌', chalk.bold.red('Error'), ...args);
