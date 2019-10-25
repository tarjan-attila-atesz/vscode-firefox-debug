import { Log } from '../../util/log';
import { ISourceActorProxy } from '../actorProxy/source';
import { SourceMappingInfo } from './info';
import { getUri } from '../../util/net';

const log = Log.create('SourceMappingSourceActorProxy');

export class SourceMappingSourceActorProxy implements ISourceActorProxy {

	public get name(): string {
		return this.source.actor;
	}

	public get url(): string {
		return this.source.url!;
	}

	private getBreakpointPositionsPromise?: Promise<FirefoxDebugProtocol.BreakpointPositions>;

	public constructor(
		public readonly source: FirefoxDebugProtocol.Source,
		private readonly sourceMappingInfo: SourceMappingInfo
	) {}

	public async getBreakpointPositions(): Promise<FirefoxDebugProtocol.BreakpointPositions> {

		if (!this.getBreakpointPositionsPromise) {
			this.getBreakpointPositionsPromise = this.getBreakpointPositionsInt();
		}

		return this.getBreakpointPositionsPromise;
	}

	private async getBreakpointPositionsInt(): Promise<FirefoxDebugProtocol.BreakpointPositions> {

		if (log.isDebugEnabled) log.debug(`Fetching generated breakpoint positions for ${this.url}`);
		let generatedBreakpointPositions = await this.sourceMappingInfo.underlyingSource.getBreakpointPositions();

		if (log.isDebugEnabled) log.debug(`Computing original breakpoint positions for ${Object.keys(generatedBreakpointPositions).length} generated lines`);
		const originalBreakpointPositions: FirefoxDebugProtocol.BreakpointPositions = {};
		for (const generatedLine in generatedBreakpointPositions) {
			for (const generatedColumn of generatedBreakpointPositions[generatedLine]) {

				const originalLocation = this.sourceMappingInfo.originalLocationFor({
					line: parseInt(generatedLine),
					column: generatedColumn
				});

				if ((originalLocation.line !== null) && (originalLocation.column !== null) &&
					(originalLocation.source === this.url)) {

					if (originalBreakpointPositions[originalLocation.line] === undefined) {
						originalBreakpointPositions[originalLocation.line] = [];
					}

					originalBreakpointPositions[originalLocation.line].push(originalLocation.column);

				}
			}
		}

		return originalBreakpointPositions;
	}

	public async fetchSource(): Promise<FirefoxDebugProtocol.Grip> {
		if (log.isDebugEnabled) log.debug(`Fetching source for ${this.url}`);
		let embeddedSource = this.sourceMappingInfo.sourceMapConsumer!.sourceContentFor(this.url);
		if (embeddedSource) {
			if (log.isDebugEnabled) log.debug(`Got embedded source for ${this.url}`);
			return embeddedSource;
		} else {
			const source = await getUri(this.url);
			if (log.isDebugEnabled) log.debug(`Got non-embedded source for ${this.url}`);
			return source;
		}
	}

	public async setBlackbox(blackbox: boolean): Promise<void> {
		this.source.isBlackBoxed = blackbox;
		this.sourceMappingInfo.syncBlackboxFlag();
	}

	public dispose(): void {
		this.sourceMappingInfo.disposeSource(this);
	}
}
