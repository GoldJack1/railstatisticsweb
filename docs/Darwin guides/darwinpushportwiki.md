The Darwin Push Port is an XML push feed that continuously streams information about the creation of, and changes to, train schedule records, together with train running predictions made by Darwin.

The data is made available through http://opendata.nationalrail.co.uk.

The Push Port requires the user to build a database capable of capturing extremely high volumes of information, as well as a query engine to draw the information from your database. There is a large amount of interpretation work involved in this; however this allows substantial flexibility to apply the information to any product within the limitations of your own infrastructure.

Data
The Push Port has two components:

Timetable and Timetable Reference Data.
Real-Time Update Data.
All Darwin data is gzipped (except for the Darwin Status Topic). XSDs for the interface are available, along with the specification.

Timetable and Timetable Reference Data
Darwin makes available Timetable and Timetable Reference Data exposed as static files that are generated usually on a daily basis. The creation of new Timetable and Timetable Reference files are alerted via TimeTableId messages in the real-time Update Data.

Timetables
Timetable data contains a set of schedules covering at least a 48-hour period held in the Darwin database. This list of schedules provides the basis on which a Darwin snapshot can be applied.

The schedules in the timetable do not include forecast or actual times although they reflect the latest state that Darwin has when the timetable file was generated, so any schedule changes, new schedules, false destinations, cancellations and associations will be included.

Reference Data
The Timetable Reference Data contains the following data referenced in timetables:

TIPLOCs, CRS codes, TOC codes and location names
TOC codes, names and website URLs
Late Running reason codes and text
Cancellation reason codes and text
Via locations
CIS codes and names
Update Data
Darwin makes available real-time updates that alert the user to changes in the state of the Darwin database, or the creation of new Timetable and Timetable Reference Data. Darwin exposes two message topics:

Darwin Live Feed Topic
Darwin Status Topic
Darwin Live Feed Topic
The live feed topic exposes all update messages. Update messages contain one or more of the following elements:

Schedule data
Association data
Actual and Forecast data
Train order data
Station Messages
Train Alerts
Tracking ID corrections
Alarms
Schedule formation
Loading
The Live Feed Topic also exposes TimeTableId messages that alert the creation of a new Timetable or Timetable Reference file.

uR and sR
During normal operation, updates in real-time are issued inside uR elements, but after a period of disconnection between the data platform and Darwin itself, delayed information may enter the feed contained instead inside sR elements. [1]

Status Messages
The Status message topic contains status messages about the health and state of the Update Data. The possible messages are:

HBINIT
The upstream live feed is running but is initialising its timetable.
HBFAIL
The upstream live feed is shutting down.
HBPENDING
The upstream live feed is operating, but part of the system is currently in failover mode. Data may be queued for a short period. Clients may remain connected and data will be delivered when available.
SNAPSHOT
The Darwin Live Feed has encountered a discontinuity of messages from upstream and is starting a snapshot to re-sync it's state.
SHUTTING-DOWN
Darwin is shutting down and the message topics will soon become unavailable.
Usage
Subscribing to Darwin
The Darwin Push Port is made available through http://opendata.nationalrail.co.uk. By creating an account, you can register for a subscription to the Darwin feed.

As a user with an active Darwin subscription, navigating to the My Feeds page will display the following details:

Darwin File Information
This section provides user details for accessing the Timetable and Timetable Reference Data via an Amazon S3 Bucket.
Darwin FTP Information
This section provides user details for accessing snapshots and 5-minute logs of the real-time Update Data via FTP.
Darwin Topic Information
This section provides user details for accessing real-time Update Data via OpenWire and STOMP message topics.
Important - Please note NRDP accounts expire after extended periods of no use. The unused account expiry period is currently set to 30 days. If you create an account and do not consume any of the feeds during this time your account will be deleted. If your account has been deleted, you will receive a notification email, and you will be able to re-register for a new account.

How do I consume the data?
Timetable and Reference Data
Timetable and Reference data can be obtained via an Amazon S3 Bucket. You will be required to connect and authenticate to S3 via the details given in Darwin File Information on your My Feeds page.

The reference data filenames are in the format "yyyymmddnnnnnn_ref_v3.xml.gz" (e.g. "PPTimetable/20230201021854_ref_v3.xml.gz"). There's usually several days of historical reference data, and different versions, so make sure you select the latest one for the right version (v3 is the correct reference data version for v16).

The reference data was previously available via FTP, this is no longer the case.

Keeping up to date
Timetable and Reference Data is updated usually on a daily basis. To indicate that a new Timetable or Timetable Reference file is available, the real-time topic will send a TimeTableId message, to identify the new Timetable or Timetable Reference Data file name.

A separate TimeTableId message will be sent for each individual Timetable or Reference Data file that becomes available. Thus, multiple TimeTableId messages will be generated in succession, one for each Timetable and Reference file schema version.

Note that due to existing schema limitations, the TimeTableId message has mandatory attributes for timetable file and timetable reference data file names. Since the TimeTableId notification message is only reporting the presence of a single file, only one of these attributes will be populated with a valid file name. The other attribute will consist only of white space.

Update Data via FTP
The FTP server provides non real-time Update Data for users that missed the real-time updates. All files are gzipped.

Darwin regularly creates Snapshot files, containing the entire state of Darwin at a given point in time. The latest snapshot file is available over FTP for end users.

Every 5 minutes of Live Feed Data since the last snapshot will be available in log files, and available over FTP.

Real-Time Update Data via OpenWire & Stomp Message Topics
The Darwin Live Feed Topic and Darwin Status Messages Topic are exposed via ActiveMQ, and can be connected to via OpenWire or STOMP. The credentials for connecting can be obtained via your Darwin Topic Information section on your My Feeds page.

If you're using STOMP, you should bear in mind that the message bodies are gzip-compressed, which means selecting a client library which properly supports the content-length header and can handle binary messages is essential. A partial List of STOMP Client Libraries is available to help with this.

STOMP and OpenWire allow durable and non-durable subscriptions. If you would like Darwin to retain messages for you on disconnection, you should use a durable subscription. Please note that message retention is limited, and is implemented to allow for short term subscriber failure, not long term message persistence.

Important: The following must be true when connecting to a Darwin Topic:

Watching Advisory Topics must be turned off.
If you are using a Durable Subscriber, your Client ID must begin with your username.
Detecting Real-Time Discontinuity
Each Update message contains a SequenceNumber header. The sequence number runs from 0 to 9,999,999. Upon reaching the end of this range the sequence number wraps around to 0.

NRDP guarantees messages are produced with sequential sequence numbers, therefore a missing sequence number indicates a missed message.

For example, if you received the following sequence numbers in order:

   0, 1, 2, 4, 5, 6
Then you have missed the message with sequence number 3.

Filtering
If you wish to, you may filter the Darwin Live Feed by message type using JMS Selectors on the MessageType header. Available message types and their respective codes include:

Description	Code
Schedule updates (consisting of Schedule, DeactivatedSchedule)	SC
Association updates	AS
Schedule formations	SF
Train order	TO
Actual and Forecast Information	TS
Loading	LO
Station messages	OW
Notifications (consisting of TrainAlert, TrackingID, RTTIAlarm)	NO
Please note that if you choose to filter messages, you will not be able to detect discontinuities in the Darwin feed.

Good Practice
You should follow the good practice guide when using this service.

See also a list of potential gotchas.

Examples
Code examples for STOMP clients are available in Github.

The advanced usage page contains examples of some advanced applications for the data feeds, including bridging the ActiveMQ feeds to your own messaging server.

Version 12 Support
Push Port v12 is no longer available as of mid-May 2019.

Support
If you are having problems with the feeds:

First, read this wiki - there's a lot of material here that will help you
Check twitter to see if an issue has been reported
If you want to discuss your problem with other people working with the service, the openraildata-talk group on Google Groups will be useful
Finally, if you're still having a problem, email dsg_nrdp.support@caci.co.uk
References
 https://groups.google.com/g/openraildata-talk/c/NQ6GgTHk00k/m/v5VHUD-bBAAJ
