let winston = require('winston');
let logger = new winston.Logger();
let loggly = require('winston-loggly-bulk');
// let Redis = require("ioredis");
let Message = null;
let ContentCache = require('./contentcache.js');
var Beanworker = require('fivebeans').worker;

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

        let messagehandler = require('./messagehandler');
        var options =
        {
            id: 'filingcabinet',
            host: process.env.BEANSTALK_SERVER,
            port: 11300,
            handlers:
            {
                message: new messagehandler(logger, db, Cache)
            },
            ignoreDefault: true
        }
        
        var worker = new Beanworker(options);
        worker.on('started',()=>{
            console.log('started');
        })
        worker.on('info',(info)=>{
            console.log(info);
        });
        worker.on('error',(err)=>{
            console.log(err);
        })
        worker.start(['messages']);
        logger.info("Message Worker Started");
        
    }
    catch (e)
    {
        logger.error(e);
        process.exit(1);
    }
}