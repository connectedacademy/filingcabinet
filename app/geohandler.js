class Handler
{
    constructor(logger, database, cache)
    {
        this.type = 'rmgeo';
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
            this.logger.verbose('Removing Geo from PUBSUB', msg.message_id);
            await this.db.update('message')
            .set({
                '_raw.coordinates':null
            })
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