import { MongoDBSaver, MongoDBSaverParams } from '@langchain/langgraph-checkpoint-mongodb';
import { Checkpoint, CheckpointMetadata, PendingWrite } from '@langchain/langgraph-checkpoint';
import { RunnableConfig } from '@langchain/core/runnables';

/**
 * Extended MongoDBSaver that adds createdAt and updatedAt timestamps
 * to checkpoint and checkpoint_writes documents.
 */
export class ExtendedMongoDBSaver extends MongoDBSaver {
  constructor(params: MongoDBSaverParams, serde?: any) {
    super(params, serde);
  }

  /**
   * Saves a checkpoint to the MongoDB database with createdAt and updatedAt timestamps.
   */
  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
  ): Promise<RunnableConfig> {
    const thread_id = config.configurable?.thread_id;
    const checkpoint_ns = config.configurable?.checkpoint_ns ?? '';
    const checkpoint_id = checkpoint.id;

    if (thread_id === void 0) {
      throw new Error(
        `The provided config must contain a configurable field with a "thread_id" field.`,
      );
    }

    const [[checkpointType, serializedCheckpoint], [metadataType, serializedMetadata]] =
      await Promise.all([
        this.serde.dumpsTyped(checkpoint),
        this.serde.dumpsTyped(metadata),
      ]);

    if (checkpointType !== metadataType) {
      throw new Error('Mismatched checkpoint and metadata types.');
    }

    const now = new Date();
    const doc = {
      parent_checkpoint_id: config.configurable?.checkpoint_id,
      type: checkpointType,
      checkpoint: serializedCheckpoint,
      metadata: serializedMetadata,
      updatedAt: now,
    };

    const upsertQuery = {
      thread_id,
      checkpoint_ns,
      checkpoint_id,
    };

    // Use $setOnInsert for createdAt to only set it on insert, not update
    await this.db.collection(this.checkpointCollectionName).updateOne(
      upsertQuery,
      {
        $set: doc,
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );

    return {
      configurable: {
        thread_id,
        checkpoint_ns,
        checkpoint_id,
      },
    };
  }

  /**
   * Saves intermediate writes associated with a checkpoint to the MongoDB database
   * with createdAt and updatedAt timestamps.
   */
  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
    const thread_id = config.configurable?.thread_id;
    const checkpoint_ns = config.configurable?.checkpoint_ns;
    const checkpoint_id = config.configurable?.checkpoint_id;

    if (
      thread_id === void 0 ||
      checkpoint_ns === void 0 ||
      checkpoint_id === void 0
    ) {
      throw new Error(
        `The provided config must contain a configurable field with "thread_id", "checkpoint_ns" and "checkpoint_id" fields.`,
      );
    }

    const now = new Date();
    const operations = await Promise.all(
      writes.map(async ([channel, value], idx) => {
        const upsertQuery = {
          thread_id,
          checkpoint_ns,
          checkpoint_id,
          task_id: taskId,
          idx,
        };

        const [type, serializedValue] = await this.serde.dumpsTyped(value);

        return {
          updateOne: {
            filter: upsertQuery,
            update: {
              $set: {
                channel,
                type,
                value: serializedValue,
                updatedAt: now,
              },
              $setOnInsert: {
                createdAt: now,
              },
            },
            upsert: true,
          },
        };
      }),
    );

    await this.db.collection(this.checkpointWritesCollectionName).bulkWrite(operations);
  }
}

