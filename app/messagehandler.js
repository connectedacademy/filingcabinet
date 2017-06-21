let rb = require('./relationships');
let Redis = require('ioredis');
let redis = new Redis(process.env.REDIS_PORT, process.env.REDIS_HOST);

class Handler
{
    constructor(logger, database, cache)
    {
        this.type = 'message';
        this.logger = logger;
        this.db = database;
        this.Cache = cache;
        this.RelationshipBuilder = new rb(logger, database);
    }

    async init()
    {
        await this.RelationshipBuilder.init();
    }

    work(payload, callback)
    {
        // console.log(message);
        try {
            let msg = payload;
            this.logger.verbose('Writing Message from PUBSUB', msg.message_id);
            msg.createdAt = Date.parse(msg.createdAt);
            msg.updatedAt = new Date();
            // console.log(msg);
            this.db.update('message')
            .set(msg)
            .upsert()
            .where({
                message_id: msg.message_id
            })
            .return('AFTER')
            .one()
            .then(async (result)=>{
                this.logger.verbose("Message Written " + result['@rid']);
                
                if (!result.processed)
                {
                    //build graph
                    await this.RelationshipBuilder.processMessage(result);

                    try
                    {
                        // send to cache:
                        this.logger.verbose('Processing Message for Cache',msg.message_id);
                        let submission = await this.Cache.HandleMessage(result);
                        if (submission)
                            redis.publish('submissions', submission['@rid']);
                    }
                    catch (e)
                    {
                        this.logger.error(e);
                    }
                    
                    redis.publish('messages', result.message_id);
                }
                else
                {
                    this.logger.verbose('Message already processed',msg.message_id);
                }

                callback('success');
            }).catch((err)=>{
                callback('bury');
                this.logger.error(err);
            });
        }
        catch (e){
            this.logger.error(e);
            callback('bury');
        }
    }
}

module.exports = Handler;