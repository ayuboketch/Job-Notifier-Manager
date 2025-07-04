type ScheduledTask = { start: () => void; stop: () => void; destroy: () => void; getStatus: () => 'scheduled' | 'running' | 'stopped' | 'destroyed'; };

function schedule( expression: string, func: () => void | Promise<void>, options?: ScheduleOptions ): ScheduledTask;

export = { schedule, }; }   