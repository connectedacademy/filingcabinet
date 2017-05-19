let settings = require('./settings.json').cache;
let _ = require('lodash');
let request = require('request-promise-native');
const URL = require('url');
const AWS = require('aws-sdk');
const fs = require('fs');
const uuid = require('uuid');
AWS.config.update({ accessKeyId: process.env.AWS_S3_KEY, secretAccessKey: process.env.AWS_S3_SECRET });

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

    async putFileToS3(data)
    {

        // Read in the file, convert it to base64, store to S3
        // let data = fs.readFile('del.txt', function (err, data) {
            // if (err) { throw err; }
        return new Promise((resolve,reject)=>{
            var base64data = new Buffer(data, 'binary');
            var s3 = new AWS.S3();
            let filename = uuid();
            s3.client.putObject({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: "submission/" + filename,
                Body: base64data,
                ACL: 'public-read'
            },function (err,resp) {
                if (err)
                {
                    this.logger.error(err);
                    reject(err);
                }
                else
                {
                    this.logger.verbose('Successfully uploaded', filename);
                    resolve();
                }
            });
        });
    }

    async putToS3(url)
    {
        this.logger.verbose('Getting url',url);        
        // get the target content
        let content = await request(url);
        // console.log(content);
        // parse for the capture object
        let capturedcontent = [];
        for (let cap of settings.capture)
        {
            let regex = new RegExp(cap.replace("\\\\","\\"));
            let captured_content = regex.exec(content);
            if (captured_content)
                capturedcontent.push(captured_content[1]);
            // console.log(captured);
        }

        if (capturedcontent.length>0)
        {
            // console.log(capturedcontent);
            //cache the capture object and all references (i.e. src, data-4c links: img, json, sidecar)

            let regex = new RegExp(settings.preview.replace("\\\\","\\"));
            // console.log(regex);
            let preview_results = regex.exec(content);
            //get resources:

            //put this in S3 as a document

            // return the s3 url of this document:

            //change the links in the doc:
            capturedcontent = _.map(capturedcontent,(c)=>{
                return c.replace(/(src=")(.*?)"/,function(all,src,token){

                    

                    if (!token.startsWith('http'))
                    {
                        let parsed = URL.parse(url);
                        return 'src="'+URL.resolve(parsed.protocol + '//' + parsed.host + parsed.pathname, token)+'"';
                    }
                });
            });

            // PREVIEW LINK
            let preview =  preview_results[1];
            if (!preview.startsWith('http'))
            {
                let parsed = URL.parse(url);
                preview = URL.resolve(parsed.protocol + '//' + parsed.host + parsed.pathname,preview);
            }

            return {
                url: 's3_cache.html',
                matched: true,
                content: capturedcontent.join(''),
                preview: preview
            };
        }
        else
        {
            throw new Error("No captures in content");
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
                        // console.log(message.user_from.id_str);
                        // find the user account it relates to:
                        let user = await this.database.select()
                            .from('user')
                            .where({
                                account_number: message.user_from.id_str,
                                service: message.service
                            }).one();
                        // if its a known user, then cache it
                        if (user)
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
                                newsubmission.html = cacheinfo.content;
                                newsubmission.matched = cacheinfo.matched;
                                newsubmission.thumbnail = cacheinfo.preview;
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
                            this.logger.error("Not a known user, wont cache content", message.user);                    
                        }
                    }
                }
            }
        }
    }
}

module.exports = ContentCache;