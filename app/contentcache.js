let settings = require('./settings.json').cache;
let _ = require('lodash');
let request = require('request-promise-native');

//S3 storage

class ContentCache
{

    constructor(database, logger)
    {
        this.database = database;
        this.logger = logger;
    }

    async init()
    {
        try
        {
            await this.database.class.create('submission');
            this.logger.info("Created Submission Class");
        }
        catch (e)
        {
            // this.logger.verbose('Cant create class',e);
            //already exists
        }

        try
        {
            this.Submission = await this.database.class.get('submission');
        }
        catch (e)
        {
            this.logger.verbose('Cant get class',e);
        }
    }

    async putToS3(url)
    {
        this.logger.verbose('Getting url',url);        
        // get the target content
        let content = await request(url);
        // console.log(content);
        // parse for the capture object
        let regex = new RegExp(settings.capture.replace("\\\\","\\"));
        // console.log(regex);

        let results = regex.exec(content);
        if (results)
        {
            //cache the capture object and all references (i.e. img, json, sidecar)

            //put this in S3 as a document

            // return the s3 url of this document:

            return {
                url: 'dummy.html',
                matched: true,
                content: results[1]
            };
        }
        else
        {
            return {
                url: 'dummy.html',                
                match: false,
                content: content
            };
        }
    }

    async HandleMessage(message)
    {
        //if message matches profile, then 
        this.logger.verbose('Checking message against cache profile',message['@rid']+'');
        //if message matches the profile for the cache, then retrive the url:

        //if it has the right hashtag:
        if (message.entities)
        {
            let found = false;
            
            for (let url of message.entities.urls)
            {
                let regex = new RegExp(settings.validate.replace("\\\\","\\"));
                // console.log(regex);

                let results = regex.exec(url.expanded_url);
                if (results)
                    found = url.expanded_url;
            }
            // if (_.includes(message.text,term))
            //     found = true;

            if (found!=false)
            {
                for (let url of message.entities.urls)
                {
                    if (url.expanded_url != found) //if its not the identification url
                    {
                        // find the user account it relates to:
                        let user = await this.database.select()
                            .from('user')
                            .where({
                                account_number: message.user_from.id_str,
                                service: message.service
                            }).one();
                        // if its a known user, then cache it
                        if (true || user)
                        {
                            //get db field details:
                            let newsubmission = {};

                            for (let token of settings.tokens)
                            {
                                let regex = new RegExp(token.regex.replace("\\\\","\\"));
                                let results = regex.exec(found);
                                if (results)
                                {
                                    newsubmission[token.name] = results[1];
                                }
                            }


                            let iscached = false;
                            let cacheinfo = null;
                            try
                            {
                                // cache this url as a submission:
                                cacheinfo = await this.putToS3(url.expanded_url);
                                iscached = true;
                            }
                            catch (e)
                            {
                                this.logger.verbose("No captured content");
                            }

                            //still save it as a submissions:
                            newsubmission.user = user['@rid'];
                            if (cacheinfo)
                            {
                                newsubmission.url = cacheinfo.url;
                                newsubmission.content = cacheinfo.content;
                                newsubmission.matched = cacheinfo.matched;
                            }
                            newsubmission.cached = iscached;
                            newsubmission.original = url.expanded_url;
                            newsubmission.cachedat = new Date();
                            try
                            {
                                await this.Submission.create(newsubmission);
                            }
                            catch(E)
                            {
                                this.logger.error('Failed submission creation',newsubmission);
                            }
                        }
                        else
                        {
                            this.logger.error("No user found", message.user);                    
                        }
                    }
                }
            }
        }
    }
}

module.exports = ContentCache;