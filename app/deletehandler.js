class Handler
{
    constructor(logger, database, cache)
    {
        this.type = 'delete';
        this.logger = logger;
        this.db = database;
        this.Cache = cache;
    }

    async init()
    {
        
    }

    async work(payload, callback)
    {
        // console.log(message);
        try {
            let msg = payload;
            this.logger.verbose('Removing Message from PUBSUB', msg.message_id);

            await this.db.delete('VERTEX','message')
            .where('message_id = "' + msg.message_id + '"').one();
            callback('success');
        }
        catch (e){
            this.logger.error(e);
            callback('bury');
        }
    }
}

module.exports = Handler;