let winston = require('winston');
let logger = new winston.Logger();
let loggly = require('winston-loggly-bulk');
let Redis = require("ioredis");
let Message = null;

let createField = async function(cls, name, type)
{
    try
    {
        await cls.property.create([
            {
                name: 'text',
                type: 'String',
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
            await db.class.create('Message', 'V');   
            logger.info("Created Message Class");
             
        }
        catch (e)
        {
            //already exists
        }

        Message = await db.class.get('Message');
        
        await createField(Message,'text','String');
        await createField(Message,'service','String');
        await createField(Message,'modifiedAt','Datetime');
        await createField(Message,'createdAt','Datetime');
        
        // logic
        redis.on('message', async function (channel, message) {
            logger.verbose('Writing Message from PUBSUB', message);

            try {
            await Message.create(message);
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