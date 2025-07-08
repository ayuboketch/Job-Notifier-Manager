type ScheduledTask = { start: () => void; stop: () => void; destroy: () => void; getStatus: () => 'scheduled' | 'running' | 'stopped' | 'destroyed'; };

type ScheduleOptions = {
	timezone?: string;
	runOnInit?: boolean;
};

declare function schedule( expression: string, func: () => void | Promise<void>, options?: ScheduleOptions ): ScheduledTask;

export { schedule };
