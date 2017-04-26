let winston = require('winston');
let logger = new winston.Logger();
let loggly = require('winston-loggly-bulk');
let Redis = require("ioredis");
let Message = null;
let ContentCache = require('./contentcache.js');

let createField = async function(cls, name, type)
{
    try
    {
        await cls.property.create([
            {
                name: name,
                type: type,
            }
        ]);
        logger.info("Adding " + name + " to Message");
    }
    catch (e)
    {
        // console.log(e);
        //properties already exist
    }
}

module.exports = async function()
{
    try
    {
        logger.add(winston.transports.Console, {
            level: 'debug',
            colorize: true,
            handleExceptions: true,
            humanReadableUnhandledException: true
        });

        logger.add(winston.transports.Loggly, {
            subdomain: process.env.LOGGLY_API_DOMAIN,
            token:process.env.LOGGLY_API_KEY,
            tags:['filingcabinet'],
            level:'error',
            json: true,
            handleExceptions: true,
            humanReadableUnhandledException: true
        });


        logger.info('Filing Cabinet Started');

        // redis connection
        let redis = new Redis(process.env.REDIS_PORT, process.env.REDIS_HOST);
        // console.log(redis);

        redis.subscribe('messages', function (err, count) {
            logger.info('Subscribed to ' + count + ' channels');
        });
        
        redis.on('connect', function () {
            logger.info('Redis Connected');        
        });

        redis.on('error', function (error) {
            logger.error(error);        
        });

        // orientdb connection
        let OrientDB = require('orientjs');

        let server = OrientDB({
            host:       process.env.ORIENTDB_HOST,
            port:       process.env.ORIENTDB_PORT,
            username:   process.env.ORIENTDB_USERNAME,
            password:   process.env.ORIENTDB_PASSWORD
        });
        logger.info("Connected to " + process.env.ORIENTDB_HOST);            
        let db = server.use(process.env.ORIENTDB_DB)
        logger.info("Using database " + db.name);
        
        try
        {
            await db.class.create('message','V');
            logger.info("Created Message Class");  
        }
        catch (e)
        {
            // logger.verbose('Cant create class',e);
            //already exists
        }

        try
        {
            Message = await db.class.get('message');
        }
        catch (e)
        {
            logger.verbose('Cant get class',e);
        }
        

        logger.info("Cache Engine Started");
        let Cache = await new ContentCache(db, logger);
        await Cache.init();

        // logic
        redis.on('message', async function (channel, message) {
            // console.log(message);
            let msg = JSON.parse(message);
            logger.verbose('Writing Message from PUBSUB', msg.message_id);
            try {
                msg.createdAt = Date.parse(msg.createdAt);
                // console.log(msg);
                db.update('message')
                .set(msg)
                .upsert()
                .where({
                    message_id: msg.message_id
                })
                .return('AFTER')
                .one()
                .then(function(result){
                    logger.verbose("Message Written " + result['@rid']);
                    try
                    {
                        logger.verbose('Processing Message for Cache',message.id);
                        Cache.HandleMessage(msg);
                    }
                    catch (e)
                    {
                        logger.error(e);
                    }
                }).catch(function(err){
                    logger.error(err);
                });
            }
            catch (e){
                logger.error(e);
            }
        });
    }
    catch (e)
    {
        logger.error(e);
        process.exit(1);
    }
}