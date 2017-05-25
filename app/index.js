let winston = require('winston');
let logger = new winston.Logger();
let loggly = require('winston-loggly-bulk');
let Message = null;
let ContentCache = require('./contentcache.js');
let Beanworker = require('fivebeans').worker;
let _ = require('lodash');


let createField = async function(cls, name, type, linkedClass)
{
    try
    {
        await cls.property.create([
            {
                name: name,
                type: type,
                linkedClass: linkedClass
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

let createIndex = async function(db,cls, name)
{
    try
    {
        await db.index.create(
            {
                name: `${cls}.${name}`,
                type: 'NOTUNIQUE_HASH_INDEX'
            }
        );
        logger.info("Adding Index " + `${cls}.${name}` + " to Message");
    }
    catch (e)
    {
        // console.log(e);
        //properties already exist
    }
}

let createCompIndex = async function(db, cls, names)
{
    try
    {
        await db.index.create(
            {
                name:'composite_index_'+cls,
                'class': cls,
                properties:names,
                type: 'NOTUNIQUE_HASH_INDEX'
            }
        );
        logger.info("Adding Composite Index " + 'composite_index_'+cls + " to Message");
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

        //update fields and indexes:
        let fields = require('./settings.json');
        for (let field of fields.relationships.tokens)
        {
            await createField(Message,field.name,'STRING');
            await createIndex(db, 'message', field.name);
        }
        await createField(Message,'createdAt','DATETIME');
        await createField(Message,'updatedAt','DATETIME');
        await createField(Message,'user','LINK','user');
        await createField(Message,'remessage','LINK','message');

        let comp_index = _.map(_.filter(fields.relationships.tokens,{compositeindex:true}),'name');
        // console.log(comp_index);
        await createCompIndex(db,'message',comp_index);
        
        
        logger.info("Cache Engine Started");
        let Cache = await new ContentCache(db, logger);
        await Cache.init();

        let messagehandler = require('./messagehandler');
        let MessageHandler = new messagehandler(logger, db, Cache)
        await MessageHandler.init();

        let deletehandler = require('./deletehandler');
        let DeleteHandler = new deletehandler(logger, db, Cache)
        await DeleteHandler.init();

        let geohandler = require('./geohandler');
        let GeoHandler = new geohandler(logger, db, Cache)
        await GeoHandler.init();

        var options =
        {
            id: 'filingcabinet',
            host: process.env.BEANSTALK_SERVER,
            port: 11300,
            handlers:
            {
                message: MessageHandler,
                delete: DeleteHandler,
                rmgeo: GeoHandler
            },
            ignoreDefault: true
        }
        
        var worker = new Beanworker(options);
        worker.on('started',()=>{
            logger.verbose("Worker Started");            
        })
        worker.on('info',(info)=>{
            logger.verbose(info);
        });
        worker.on('error',(err)=>{
            logger.error(err);
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