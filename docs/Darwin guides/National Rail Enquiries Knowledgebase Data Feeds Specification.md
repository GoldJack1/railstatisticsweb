National Rail Enquiries
Knowledgebase
Data Feeds Specification
Subject Ref: RSPS5050
Version: P-03-00 Rev A
Rail Settlement Plan Limited Registered Office, First Floor North, 1 Puddle Dock, London, EC4V 3DS
www.raildeliverygroup.com 020 7841 8000 Registered in England and Wales No. 03069042
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 2 of 48
Copyright
The copyright in this work is vested in Rail Settlement Plan Limited and the information contained herein is
confidential. This work (either in whole or in part) must not be modified, reproduced, disclosed or disseminated
to others or used for purposes other than that for which it is supplied, without the prior written permission of
Rail Settlement Plan Limited. If this work or any part hereof is furnished to a third party by virtue of a contract
with that party, use of this work by such party shall be governed by the express contractual terms between
Rail Settlement Plan Limited which is a party to that contract and the said party. © 2025
Train Information Services Limited
The intellectual property rights of the National Rail data feeds documented here are owned by Train Information
Services Limited.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 3 of 48
Version History
Version Comments
P-03-00 Addition of Stations JSON feed.
P-03-00
Details regarding the Pre-prod and Production access points for Stations JSON added.
Rev A
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 4 of 48
Contents
1. Introduction ............................................................................................................................ 7
1.1 General .................................................................................................................................... 7
1.2 Full Service access .................................................................................................................. 7
1.3 Rail Data Marketplace .............................................................................................................. 8
1.4 Alerts and Notifications ............................................................................................................ 8
2. Data definitions and use ....................................................................................................... 9
2.1 XML and JSON feed configuration .......................................................................................... 9
2.2 Data feeds and Versions .......................................................................................................... 9
3. ‘TOC’ schema ....................................................................................................................... 10
3.1 Overview ................................................................................................................................ 10
3.2 Version 4.0 ............................................................................................................................. 10
3.2.1 NRE website ..................................................................................................................... 10
3.2.2 XSD ................................................................................................................................... 10
3.2.3 Elements ........................................................................................................................... 10
4. ‘Ticket Types’ schema ......................................................................................................... 13
4.1 Overview ................................................................................................................................ 13
4.2 Version 4.0 ............................................................................................................................. 13
4.2.1 NRE website ..................................................................................................................... 13
4.2.2 XSD ................................................................................................................................... 13
4.2.3 Elements ........................................................................................................................... 13
5. ‘Ticket Restrictions’ schema .............................................................................................. 16
5.1 Overview ................................................................................................................................ 16
5.2 Version 4.0 ............................................................................................................................. 16
5.2.1 NRE website ..................................................................................................................... 16
5.2.2 XSD ................................................................................................................................... 16
5.2.3 Elements ........................................................................................................................... 16
6. ‘Stations’ JSON Schema ..................................................................................................... 19
6.1 Overview ................................................................................................................................ 19
6.2 Version 1.0 ............................................................................................................................. 19
6.3 Authentication ........................................................................................................................ 20
7. ‘Stations’ XML schema ........................................................................................................ 21
7.1 Overview ................................................................................................................................ 21
7.2 Version 4.0 ............................................................................................................................. 21
7.2.1 NRE website ..................................................................................................................... 21
7.2.2 XSD ................................................................................................................................... 21
7.2.3 Elements ........................................................................................................................... 21
8. ‘Promotions’ schema ........................................................................................................... 29
8.1 Overview ................................................................................................................................ 29
8.2 Version 4.0 ............................................................................................................................. 29
8.2.1 NRE website ..................................................................................................................... 29
8.2.2 XSD ................................................................................................................................... 29
8.2.3 Elements ........................................................................................................................... 29
9. ‘National Service Indicator’ schema .................................................................................. 35
9.1 Overview ................................................................................................................................ 35
9.2 Version 4.0 ............................................................................................................................. 35
9.2.1 NRE website ..................................................................................................................... 35
9.2.2 XSD ................................................................................................................................... 35
9.2.3 Elements ........................................................................................................................... 35
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 5 of 48
10. ‘Incidents’ schema ............................................................................................................... 37
10.1 Overview ................................................................................................................................ 37
10.2 Version 5.0 ............................................................................................................................. 37
10.2.1 NRE website ..................................................................................................................... 37
10.2.2 XSD ................................................................................................................................... 37
10.2.3 Elements ........................................................................................................................... 37
11. Common data ....................................................................................................................... 40
11.1 Overview ................................................................................................................................ 40
11.2 Version 4.0 ............................................................................................................................. 40
11.2.1 XSD ................................................................................................................................... 40
11.2.2 Change History Structure ................................................................................................. 40
11.2.3 Available Facility Structure ............................................................................................... 40
11.2.4 Service Structure .............................................................................................................. 40
11.2.5 Travelcards Structure........................................................................................................ 41
11.2.6 Opening Hours Structure .................................................................................................. 41
11.2.7 Telephone Structure ......................................................................................................... 41
11.2.8 Postal Address Structure .................................................................................................. 41
11.2.9 Contact Details Structure .................................................................................................. 41
11.2.10 Annotated Structure .......................................................................................................... 42
11.2.11 Annotation Content ........................................................................................................... 42
11.2.12 Day and Time Availability Structure .................................................................................. 42
11.2.13 Days Group ....................................................................................................................... 42
11.2.14 Daily Opening Hours Structure ......................................................................................... 42
11.2.15 Closed Time Range Structure .......................................................................................... 43
11.2.16 Half Open Date Range Structure ...................................................................................... 43
11.2.17 Half Open Time Range Structure ..................................................................................... 43
11.2.18 Half Open Timestamp Range Structure............................................................................ 43
11.2.19 Telephone Number Structure ........................................................................................... 44
11.2.20 Crs Code List Structure..................................................................................................... 44
11.2.21 Atoc List Structure ............................................................................................................. 44
11.2.22 Station Group List Structure ............................................................................................. 44
11.2.23 Station List Structure......................................................................................................... 44
11.2.24 Simple Types .................................................................................................................... 44
12. Address Types ..................................................................................................................... 46
12.1 Version 2.0 ............................................................................................................................. 46
12.1.1 UK Address Structure ....................................................................................................... 46
12.1.2 UK Postal Address Structure ............................................................................................ 46
13. BS7666 Address ................................................................................................................... 47
13.1 Version 2.0 ............................................................................................................................. 47
13.1.1 BS7666 Address ............................................................................................................... 47
13.1.2 BS Address Structure ....................................................................................................... 47
13.1.3 AON structure ................................................................................................................... 47
13.1.4 AON range Structure ........................................................................................................ 47
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 6 of 48
Terms and Definitions
Term Meaning
ASSIST Accreditation Standards Site Integrating System Toolset.
CCTV Closed Circuit Television.
CMS Content Management System.
CRS Code A 3-character code issued to every railway station in Britain.
IP Address Internet Protocol address.
JSON JavaScript Object Notation; a lightweight data-interchange format.
KB / iKB NRE KnowledgeBase.
Mand Mandatory.
Mult Multiple.
NaPTAN National Public Transport Access Node.
NLC National Location Code, a four-character alphanumeric code assigned to every
retailing location and railway station in Britain.
NRDP National Rail Data Portal.
NRE National Rail Enquiries.
NSI National Service Indicator.
RDM Rail Data Marketplace.
REST Representational State Transfer.
SLA Service Level Agreement.
STD Subscriber Trunk Dialling.
TIPLOC Timing Point Location.
TOC Train Operating Company.
URI Uniform Resource Identifier.
URL Uniform Resource Locator.
WCF Microsoft Windows Communication Foundation framework.
XML eXtensible Markup Language.
XSD XML Schema file.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 7 of 48
1. Introduction
1.1 General
1.1.1 The purpose of this document is to provide information on the use of National Rail Enquiries
(NRE) KnowledgeBase (KB) data.
1.1.2 KnowledgeBase is a system used by NRE which maintains data used in their websites and
other channels and is the official source of train information for the industry.
1.1.3 Train companies are responsible for updating their own information using the backend CMS
to KB, all other data is updated via NRE content editors.
1.1.4 This document will be updated and distributed following any update of the JSON or XML
schemas.
1.1.5 The XML Schemas are available for download from ASSIST or the NRE website.
1.1.6 The JSON schema details are available within the Open API Specifications. It includes the
endpoints and request/response structures (including examples) that the API exposes. Specs
are available for download from ASSIST or the NRE website.
1.1.7 This document details the ‘Full Service’ in section 1.2 and gives information on the ‘Open Data’
versions via the ‘Rail Data Marketplace’ in section 0.
1.1.8 The data feeds are documented in section 2 ‘Data definitions and use’.
1.2 Full Service access
1.2.1 The service is for TOCs, TOC 3rd parties and WebTIS.
1.2.2 The ‘Full Service’ works to a ‘24/7’ 99.99% SLA.
1.2.3 Only approved and static IP addresses can gain full access to the data feeds via a data feed
licence.
1.2.4 To request access, please use the Rail Data Marketplace.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 8 of 48
1.3 Rail Data Marketplace
1.3.1 Since November 2023, the data feeds have been made be available via the ‘Rail Data
Marketplace’ (RDM) which replaces ‘National Rail Data Portal’ (NRDP).
1.3.2 RDM is a self-signup service for ‘open data’ users at no cost for the data but with lower Service
Level Agreements (SLAs) than the ‘Full Service’ and different usage terms and conditions.
1.3.3 RDM is available at https://raildata.org.uk.
1.3.4 Support: There is no formal support direct from the supplier for open data users however
minimal support is available via the RDM platform.
1.4 Alerts and Notifications
1.4.1 If you would like to receive release or incident notification's, you can sign up for notification's
by following this link - http://eepurl.com/6TvTT.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 9 of 48
2. Data definitions and use
2.1 XML and JSON feed configuration
2.1.1 The feeds are configured as web services following a resource-oriented design, allowing
clients to request specific feed resources through defined endpoints.
2.1.2 These services handle incoming requests for feeds and return the corresponding resource
data based on the request parameters in XML or JSON format depending on the particular
endpoint used.
2.2 Data feeds and Versions
2.2.1 Each KB data feed is listed below along with version availability information.
Data feed Type Version Available
from
Withdrawn date Poll frequency
TOCs XML 4.0 Now None At least once
every 24 hours.
Ticket Types XML 4.0 Now None At least once
every 24 hours.
Ticket Restrictions XML 4.0 Now None At least once
every 24 hours.
Stations XML 4.0 Now None Once every 24
hours.
Stations JSON 1.0 Now None Once every 24
hours.
Promotions XML 4.0 Now None At least once
every 24 hours.
National Service
XML 4.0 Now None Recommend
Indicator
every 5 minutes.
Incidents XML 5.0 Now None Recommend
every 5 minutes.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 10 of 48
3. ‘TOC’ schema
3.1 Overview
3.1.1 This section defines the structure and provides a high-level description of the TOC XML tags.
3.1.2 Where a tag is marked mandatory (‘Mand’), consumers can rely upon the presence of this tag.
Tags not marked mandatory are optional, i.e., consumers should not rely on these elements
existing. Child tags marked as mandatory are only mandatory if their parent tag exists.
3.1.3 Where a tag is marked multiple (‘Mult’), this means that this tag can be repeated, tags not
marked as multiple will not be repeated.
3.2 Version 4.0
3.2.1 NRE website
3.2.1.1 The NRE website displays this data at the following URL:
https://www.nationalrail.co.uk/travel-information/find-a-train-company/
In addition, the following URL may be used where ?? is a two-character TOC code
such as ‘LE’ or ‘XC’:
https://www.nationalrail.co.uk/travel-information/operators/??
For example:
https://www.nationalrail.co.uk/travel-information/operators/aw
3.2.2 XSD
3.2.2.1 nre-toc-v4-0.xsd
3.2.3 Elements
3.2.3.1 Root
Field Mandatory Multiple Type/Values Description
TrainOperatingCompanyList Y N See § 0 Root element for Train Operating Companies
feed which will contain one or more child
elements.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 11 of 48
3.2.3.2 Train Operating Company
Field Mand Mult Type/Values Description
TrainOperatingCompany N Y See § 3.2.3.3 Container for TOC level information.
3.2.3.3 Train Operating Company Structure
Field Mand Mult Type/Values Description
ChangeHistory Y N See § 11.2.1 Last changed by details.
e.g., Changed by Joe Bloggs @ 11:00 on 23rd June 2015.
AtocCode Y N String (2) Two-character TOC code.
e.g., ‘LE’ or ‘XC’.
AtocMember N N Boolean Is the operator a member of ATOC?
e.g., ‘true’.
StationOperator N N Boolean Does the operator manage stations?
e.g., ‘false’.
Name Y N String Brand name of the operator.
e.g., ‘Greater Anglia’.
LegalName Y N String Legal name of the operator.
e.g., ‘London Eastern Railways’.
ManagingDirector N N String Name of operator’s managing director.
e.g., ‘John Smith’
.
Logo N N URI URI to operator’s logo on NRE desktop website.
NetworkMap N N URI URI to operator’s network map, usually on their own website.
OperatingPeriod N N See § 3.2.3.4 Operating period of operator, usually a start date of their
franchise.
HeadOfficeContactDetails N N See § 11.2.9 Address and phone details of operator’s head office.
CompanyWebsite N N URI URI of operator’s main desktop website.
SupportAndInformation N N See § 3.2.3.5 Various operator support details, such as lost property and
cycling.
TicketingAndFares N N See § 3.2.3.6 Various operator details relating to ticket and fare policies.
3.2.3.4 Operating Period Structure
Field Mand Mult Type/Values Description
StartDate N N Date Start date of operator’s operating period.
e.g., 12 June 2013.
EndDate N N Date Start date of operator’s operating period.
e.g., 1 September 2019.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 12 of 48
3.2.3.5 Support and Information Structure
Field Mand Mult Type/Values Description
CustomerService N N See § 11.2.4 Operator’s Customer Service information.
LostProperty N N See § 11.2.4 Operator’s lost property information.
AssistedTravel N N See § 11.2.4 Operator’s Assisted Travel policies and information.
CyclePolicyUrl N N URI URI of the operator’s cycling policy (if known).
e.g.
http://www.arrivatrainswales.co.uk/Bicycles/
3.2.3.6 Ticketing and Fares Structure
Field Mand Mult Type/Values Description
TeleSales N N See § 11.2.4 Operator’s telesales information.
GroupTravel N N See § 11.2.4 Operator’s Group travel policies and information.
BusinessTravel N N See § 11.2.4 Operator’s business travel policies and information.
SeatReservations N N See § 11.2.4 Operator’s seat reservation policies and information.
PenaltyFaresUrl N N URI URI to information regarding operator’s penalty fare
policies.
e.g.
http://www.c2c-
online.co.uk/assistance/faqs/penalty-fares/
BuyingTickets N N See § 11.2.11 Operator’s ticket purchasing policies and information.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 13 of 48
4. ‘Ticket Types’ schema
4.1 Overview
4.1.1 This section defines the structure and provides a high-level description of the Ticket Types
XML tags.
4.1.2 Where a tag is marked mandatory, consumers can rely upon the presence of this tag. Tags
not marked mandatory are optional, i.e., consumers should not rely on these elements
existing. Child tags marked as mandatory are only mandatory if their parent tag exists.
4.1.3 Where a tag is marked multiple, this means that this tag can be repeated, tags not marked as
multiple will not be repeated.
4.1.4 Errors and omissions can be reported to rdgretailapprover@raildeliverygroup.com .
4.2 Version 4.0
4.2.1 NRE website
4.2.1.1 The NRE website displays this data at the following URL:
https://www.nationalrail.co.uk/ticket-types/ticket-validity-finder/
In addition, the following URL may be used where ??? is a three-character ticket type
code such as ‘GOR’:
https://www.nationalrail.co.uk/ticket-types/tickets/???
For example:
https://www.nationalrail.co.uk/ticket-types/tickets/GOR
4.2.2 XSD
4.2.2.1 nre-ticket-v4-0.xsd
4.2.3 Elements
4.2.3.1 Root
Field Mandatory Multiple Type/Values Description
TicketTypeDescriptionList Y N See § 4.2.3.2 Root element for Ticket Types
feed which will contain one or
more child elements.
4.2.3.2 Ticket Type Description
Field Mand Mult Type/Values Description
TicketTypeDescription N Y See § 4.2.3.3 Container for Ticket Type level
information.
4.2.3.3 Ticket Type Description Structure
Field Mand Mult Type/Values Description
TicketTypeIdentifier Y N String (32) Unique identifier for entry in XML.
e.g.,
‘297422B8CC2D477192F0021CFFBABD1F’.
© Rail Settlement Plan Limited 2025
TicketTypeCode TicketTypeName Description Class SingleReturn ApplicableTocs Validity BreakOfJourney FareCategory Conditions Availability Retailing BookingDeadlines CompulsoryReservations ChangesToTravelPlans Refunds Discount SpecialConditions National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 14 of 48
Y Y String (3) List of ticket type codes these terms and
conditions apply to.
e.g., ‘SOS’
,
‘FDS’
,
‘1SD’, etc.
Y N String Customer friendly description of ticket.
e.g., ‘Advance (Day)’.
Y N String Overview of ticket type’s properties.
e.g., ‘Advance tickets are single (one-way)
tickets…’ etc.
Y N First,
Class of travel.
Standard,
Other
Y N Single,
Whether ticket type(s) valid for a single journey
Return
or a return journey.
N N See § 4.2.3.4 A list of TOCs.
N N See § 4.2.3.5 Outward and Return validity information.
N N See § 4.2.3.6 Outward and Return break of journey
information.
Y N Open,
Fare category of ticket type(s):
Flexible,
- Open equals “Anytime”.
Restricted
- Flexible equals “Off-Peak”.
- Restricted equals “Advance”.
N N String General conditions for ticket type(s).
e.g., ‘You must be at the departure station
shown on the ticket…’ etc.
N N String Availability conditions for ticket type(s).
e.g., ‘Tickets are valid ONLY on the date and…’
etc.
N N String Retailing instructions for ticket type(s).
e.g., ‘Ticket offices, travel centres and travel
agents…’ etc.
N N String Booking deadlines for ticket type(s).
e.g., ‘Tickets must be bought by 18:00…’ etc.
N N String Does the ticket require a reservation to be valid?
e.g., ‘Yes’
N N String Terms and conditions relating to changes to
travel plans.
e.g., ‘Changes to time or date of travel
must…’ etc.
N N String Terms and Conditions relating to refunds.
e.g., ‘Your ticket is non-refundable.’.
N N See § 4.2.3.7 Discounts permitted for the ticket type(s).
N N String Special conditions for ticket type(s).
e.g., ‘Tickets are only available from…’ etc.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 15 of 48
4.2.3.4 Applicable TOCs Structure
Field Mand Mult Type/Values Description
IncludedTocs N N See § 11.2.21 List of TOCs which are included in the ticket
type(s). e.g., ‘LE’, ‘VT’.
OR
Field Mand Mult Type/Values Description
ExcludedTocs N N See § 11.2.21 List of TOCs which are excluded from the
ticket type(s). e.g., ‘AW, ‘NT’.
4.2.3.5 Validity Structure
Field Mand Mult Type/Values Description
DayOutward N N String Description of the Outward day validity conditions.
e.g., ‘Valid only on the date shown on the ticket.’
DayReturn N N String Description of the Return day validity conditions.
e.g., ‘Not applicable.’
TimeOutward N N String Description of the Outward time validity conditions.
e.g., ‘Valid only at the specified time and train printed on the
ticket.’
TimeReturn N N String Description of the Return time validity conditions.
e.g., ‘Valid any time.’
4.2.3.6 Break of Journey Structure
Field Mand Mult Type/Values Description
OutwardNote N N String Description of the Outward break of journey conditions.
e.g., “Break of journey is allowed on all Anytime Day tickets.”
ReturnNote N N String Description of the Return break of journey conditions.
e.g., “Not applicable.”
4.2.3.7 Discount Structure
Field Mand Mult Type/Values Description
Child N N See § 4.2.3.8 Discounts relating to children.
RailCard N N See § 4.2.3.8 Discounts relating to Railcards.
Group N N See § 4.2.3.8 Discounts relating to groups.
4.2.3.8 Discount Detail Structure
Field Mand Mult Type/Values Description
Permitted N N Boolean Do the ticket type(s) offer this type of discount? e.g., ‘true’.
Note N N String Description of discount amounts, terms, and conditions.
e.g., ‘Children (aged 5 to 15 inclusive) are offered a 50% discount.’
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 16 of 48
5. ‘Ticket Restrictions’ schema
5.1 Overview
5.1.1 This section defines the structure and provides a high-level description of the Ticket
Restrictions XML tags.
5.1.2 Where a tag is marked mandatory, consumers can rely upon the presence of this tag. Tags
not marked mandatory are optional, i.e., consumers should not rely on these elements
existing. Child tags marked as mandatory are only mandatory if their parent tag exists.
5.1.3 Where a tag is marked multiple, this means that this tag can be repeated, tags not marked as
multiple will not be repeated.
5.1.4 TIS/JP must not assume that entries in Fares data have corresponding entries in
KnowledgeBase data.
5.1.5 Errors and omissions can be reported to rdgretailapprover@raildeliverygroup.com.
5.2 Version 4.0
5.2.1 NRE website
5.2.1.1 The NRE website displays this data at the following URL:
https://www.nationalrail.co.uk/ticket-types/ticket-validity-finder/
In addition, the following URL may be used where ?? is a two-character restriction
code such as ‘1A’ or ‘WC’, for example:
https://www.nationalrail.co.uk/ticket-types/validity/1A
5.2.2 XSD
5.2.2.1 nre-ticket-restriction-v4-0.xsd
5.2.3 Elements
5.2.3.1 Root
Field Mandatory Multiple Type/Values Description
TicketRestrictions Y N See § 5.2.3.2 Root element for Ticket Restrictions feed
which will contain one or more child
elements.
5.2.3.2 Ticket Restriction
Field Mand Mult Type/Values Description
TicketRestriction N Y See § 5.2.3.3 Container for Ticket Restriction level
information.
5.2.3.3 Ticket Restriction Structure
Field Mand Mult Type/Values Description
© Rail Settlement Plan Limited 2025
Name Y N LinkToDetailPage Y N RestrictionCode Y N TicketRestrictionIdentifier Y N ApplicableDays Y N Easement N N Notes N N SeasonalVariations N N OutwardDirection Y N ReturnDirection Y N ReturnStatus N N OutwardStatus N N RestrictionsType Y N Restrictions Y N 5.2.3.4 Restriction
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 17 of 48
String (>1) Restriction code Name – usually the same as restriction
code. e.g., ‘1A’.
String URI of restriction page on NRE desktop website.
e.g.
http://www.nationalrail.co.uk/times_fares/
ticket_types/64259.aspx
String (>1) Industry restriction code, currently 2 characters but may
increase to 5 characters in due course.
e.g., ‘1A’, ‘WC’, ‘XF456’.
String Unique identified for this restriction within knowledgebase.
e.g., ‘35CB817C8EBC46D78935525727BB39EA’.
String (>1) Free text capture of what days a restriction applies to.
e.g., ‘Mondays to Fridays’.
String Free text description of any easements.
e.g., ‘Clacton-on-Sea to London Liverpool Street service…’
etc.
String Free text notes relating to restriction.
e.g., ‘For journeys to/from East Anglia via Ely…’ etc.
String Free text description of any seasonal variations applicable
to this restriction.
e.g., ‘Evening peak restrictions from Liverpool Street…’
etc.
String Captures what type of direction applies to the outward
journey restriction.
One of:
‘Outward Travel’, ‘Morning Travel’, ‘Eastbound Travel’,
‘Northbound Travel’, ‘Southbound Travel’, ‘Westbound
Travel’, ‘From London’, ‘Towards London’, ‘Outward’,
‘Return’.
String Captures what type of direction applies to the return
journey restriction.
One of:
‘Return Travel’, ‘Evening Travel’, ‘Westbound Travel’,
‘Southbound Travel’, ‘Northbound Travel’, ‘Eastbound
Travel’, ‘From London’, ‘Towards London’, ‘Outward’,
‘Return’.
String Free text description of conditions applying to the return
direction.
e.g., ‘By any train’
String Free text description of conditions applying to the return
direction.
e.g., ‘Not valid for travel until:’
2 or 4 Set to either ‘2’ or ‘4’ to indicate a basic restriction type
(i.e., a 2-column restriction) or a complex restriction type
(i.e., a 4-column restriction).
Note: basic restriction type (2) does not imply the
restriction terms will themselves be basic. 4-column
(complex) restriction type has been deprecated and is not
currently used.
See § 5.2.3.4 The main restriction terms and conditions.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 18 of 48
Field Mand Mult Type/Values Description
Restriction Y Y See § 5.2.3.5 Splits the main restriction terms and conditions into one or
more sections.
5.2.3.5 Restriction Structure
Field Mand Mult Type/Values Description
StationOutward N N String (3) Applicable station in outward direction.
e.g., ‘COL’
.
StationReturn N N String (3) Applicable station in return direction.
e.g., ‘LST’
.
DetailsOutward Y N String (>1) Free text description on restriction’s outward terms and
conditions.
e.g., ‘Not valid on trains timed to depart London
Terminals…’ etc.
DetailsReturn N N String Free text description on restriction’s return terms and
conditions.
e.g., ‘Not valid on trains timed to depart London
Terminals…’ etc.
CommentsOutward N N String Free text additional comments on outward restriction.
CommentsReturn N N String Free text additional comments on return restriction.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 19 of 48
6. ‘Stations’ JSON Schema
6.1 Overview
6.1.1 The JSON structure and description of the Stations JSON tags is defined within the JSON
Schema - Open API Specification:
stations-feed-open-api-spec-v1-0.json
6.1.2 The content of this API is updated overnight; Poll frequency should only be once every 24
hours.
6.1.3 Non-prod (or UAT) is only available to:
• Government or other public body
• Rail industry body (such as National Rail, Rail Safety and Standards Board)
• Train or freight operating company
Production is available to all.
6.2 Version 1.0
6.2.1 The API is supported in the URL of the request:
For example: /json/1.0/stations/eus
6.2.2 Access Points via RDM interface:
Pre-prod:
https://raildata.org.uk/dashboard/dataProduct/P-f515055e-45ac-4706-b2da-
1a5b42f774cf/overview
Production1:
https://raildata.org.uk/dashboard/dataProduct/P-9c97bd03-e2f2-462d-860a-
5bec92700c2d/overview
6.2.3 Endpoints
HTTP Method Path Description
GET /stations Get details for all stations. Please note the /stations
endpoint returns a large payload, which may impact page
performance. If the Specification tab takes extra time to
load, try testing the request with a REST client or directly in
your code.
GET /stations/{crs} Get details for a particular station by the 3-character CRS
Code.
GET /stations/tocs/{toc} Get all stations that are operated by a particular TOC by the
2-character TOC code.
1 Added to documentation in Version 03-00 Rev A.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 20 of 48
6.3 Authentication
6.3.1 An API Key will be required to access the JSON feed via RDM.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 21 of 48
7. ‘Stations’ XML schema
7.1 Overview
7.1.1 This section defines the structure and provides a high-level description of the Stations XML
tags.
7.1.2 Where a tag is marked mandatory, consumers can rely upon the presence of this tag. Tags
not marked mandatory are optional, i.e., consumers should not rely on these elements
existing. Child tags marked as mandatory are only mandatory if their parent tag exists.
7.1.3 Where a tag is marked multiple, this means that this tag can be repeated, tags not marked as
multiple will not be repeated.
7.2 Version 4.0
7.2.1 NRE website
7.2.1.1 The NRE website displays this data at the following URL:
https://www.nationalrail.co.uk/find-a-station/
Full station names or three-character station CRS codes, such as ‘BHM’ or ‘KGX’
,
may be used. For example:
https://www.nationalrail.co.uk/stations/Birmingham-new-street/
or
https://www.nationalrail.co.uk/stations/bhm/
7.2.2 XSD
7.2.2.1 nre-station-v4-0.xsd
7.2.3 Elements
7.2.3.1 Root
Field Mandatory Multiple Type/Values Description
StationList Y N See § 7.2.3.2 Root element for Stations feed which will
contain one or more child elements.
7.2.3.2 Stations
Field Mand Mult Type/Values Description
Station N Y See § 7.2.3.3 Container for Station information.
7.2.3.3 Station Structure
Field Mand Mult Type/Values Description
ChangeHistory Y N See § 11.2.1 Who changed the data most recently?
CrsCode Y N String (3) Three-character CRS code identifying a station.
AlternativeIdentifiers Y N See § 0 Alternative identifiers for this station.
© Rail Settlement Plan Limited 2025
Name SixteenCharacterName Address Longitude Latitude StationOperator Staffing InformationSystems Fares PassengerServices StationFacilities Accessibility Interchange StationAlerts TrainOperatingCompanies StationCategory National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 22 of 48
Y N String The canonical name of the station. This is the full
name of the station.
e.g., ‘North Wembley’.
Y N String (1-16) A unique name for the station with maximum 16
characters.
N N See § 11.2.8 Address of the station.
Y N Decimal The longitude of the station as supplied by
NaPTAN.
e.g. -0.3039843835
Y N Decimal The latitude of the station as supplied by
NaPTAN.
e.g., 51.5626022528
Y N String (2) The operator of the station: a TOC or Network
Rail.
Y N See § 7.2.3.6 Information about the staffing of the station.
N N See § 7.2.3.8 Details of the passenger information available at
the station.
N N See § 0 Fare related information for this location.
N N See § 7.2.3.13 Contact information and opening hours of
passenger services offered at this station.
N N See § 7.2.3.14 Availability of facilities at this station.
N N See § 7.2.3.15 Accessibility information for this station.
N N See § 7.2.3.17 Information about changing between services at
the station.
N N See § 7.2.3.22 Alerts affecting the station.
Y N See § 7.2.3.23 TOCs who operate at this location.
N N String Not used.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 23 of 48
7.2.3.4 Alternative Identifiers Structure
Field Mand Mult Type/Values Description
NationalLocationCode Y N String (4-7) NLC code for this station. e.g., ‘1444’.
Tiplocs N N See § 0 A list of TIPLOCs located at this station.
7.2.3.5 TIPLOC Structure
Field Mand Mult Type/Values Description
Tiploc N Y String (4-7) Timing Point Location code. There may be more than one of these per
station.
e.g., ‘CLPHMJC’
,
‘CLPHMJM’, etc.
7.2.3.6 Staffing Structure
Field Mand Mult Type/Values Description
StaffingLevel N N fullTime,
Whether the station is staffed.
partTime,
unstaffed
ClosedCircuitTelevision Y N See § 7.2.3.7 Is there CCTV in operation at the station?
7.2.3.7 CCTV Structure
Field Mand Mult Type/Values Description
Available Y N Boolean Whether the station has CCTV or not.
e.g. ‘true’.
7.2.3.8 Information Systems Structure
Field Mand Mult Type/Values Description
InformationAvailableFromStaff N Y String Staff information point available?
e.g., ‘Yes’.
InformationServicesOpen N N See § 11.2.6 Opening times of information services.
CIS N Y DepartureScreens,
Facilities available for the Customer
ArrivalScreens,
Information System.
Announcements
CustomerHelpPoints N N See § 11.2.3 Is there an information point / desk /
kiosk?
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 24 of 48
7.2.3.9 Fares Structure
Field Mand Mult Type/Values Description
TicketOffice N N See § 11.2.3 Ticket Office for the station.
PrepurchaseCollection N N See § 0 Whether pre-purchased tickets can be
collected at this station.
TicketMachine N N See § 7.2.3.11 Details on the Ticket Machine facilities at the
station.
OystercardIssued N N Boolean Whether you can use Oyster/Pre-Pay at this
station.
e.g., ‘true’.
OystercardTopup N N See § 0 Whether you can Top Up Oyster cards at this
station.
UseOystercard N N Boolean Validate Oyster cards at the station.
e.g., ‘false’.
OysterComments N N See § 11.2.11 Oyster card related comments.
AlwaysShowOysterCardFields N N Boolean Always show the oyster card fields.
e.g., ‘false’.
SmartcardIssued N N Boolean Can a smartcard be issued at the station?
e.g., ‘true’.
SmartcardTopup N N See § 0 Whether you can Top Up Smartcards at the
station.
SmartcardValidator N N Boolean Validate Smartcards at the station.
e.g., ‘true’.
SmartcardComments N N See § 11.2.11 Smartcard related comments.
Travelcard N N See § 11.2.5 Travelcard information for this station.
PenaltyFares N N See § 7.2.3.12 Information of penalty fares at this station.
7.2.3.10 Ticket Pickup Structure
Field Mand Mult Type/Values Description
TicketOffice N N Boolean Pre-purchase collection method. e.g., ‘true’.
TicketMachine N N Boolean Pre-purchase collection method. e.g., ‘true’.
OR
Field Mand Mult Type/Values Description
NotAvailable N N Boolean Pre-purchase collection not available. e.g., ‘true’.
7.2.3.11 Ticket Machine Structure
Field Mand Mult Type/Values Description
Available N N Boolean Whether there is a Ticket Machine at this station. e.g., ‘false’.
7.2.3.12 Penalty Fares Structure
Field Mand Mult Type/
Description
Values
TrainOperator N Y String Two-character TOC code. e.g., ‘AW’.
Url N N URI URL for station operator’s penalty fares policy.
e.g.
http://www.arrivatrainswales.co.uk/revenueenforcementpolicy
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 25 of 48
7.2.3.13 Passenger Services Structure
Field Mand Mult Type/Values Description
CustomerService N N See § 11.2.4 Customer service contact details for the station.
TeleSales N N See § 11.2.4 Contact details for buying tickets for travel from this
station.
LeftLuggage N N See § 11.2.4 Information about any left luggage facilities at the station.
LostProperty N N See § 11.2.4 Contact details for lost property enquiries at the station.
7.2.3.14 Station Facilities Structure
Field Mand Mult Type/Values Description
Annotation N N See § 0 Station facilities notes.
FirstClassLounge N N See § 11.2.3 Does the station have a first-class lounge?
SeatedArea N N See § 11.2.3 Does the station have an area with seats?
WaitingRoom N N See § 11.2.3 Does the station have a general waiting room?
Trolleys N N See § 11.2.3 Are luggage trolleys available at the station for
passenger use?
StationBuffet N N See § 11.2.3 Does the station have a Buffet?
Toilets N N See § 11.2.3 Details on station toilets.
BabyChange N N See § 11.2.3 Does the station have facilities to change baby's
nappies?
Showers N N See § 11.2.3 Does the station have showers?
Telephones N N See § 11.2.7 Details the stations telephone facilities.
WiFi N N See § 11.2.3 Does the station have a public 802.11 wireless
network?
WebKiosk N N See § 11.2.3 Does the station have a Kiosk?
PostBox N N See § 11.2.3 Does the station have a post box?
TouristInformation N N See § 11.2.3 Does the station have tourist information available?
AtmMachine N N See § 11.2.3 Does the station have an ATM Machine?
BureauDeChange N N See § 11.2.3 Does the station have a Bureau de Change?
Shops N N See § 11.2.3 Does the station have shops?
7.2.3.15 Accessibility Structure
Field Mand Mult Type/Values Description
Helpline N N See § 11.2.4 Impaired access helpline for station.
StaffHelpAvailable N N See § 11.2.3 Are there staff available to help customers
with impaired access?
InductionLoop N N Boolean Is there an Induction Loop for Deaf people
at the station?
e.g., ‘true’.
AccessibleTicketMachines N N See § 11.2.3 Are Ticket Machines Accessible to all
Disabled people?
HeightAdjustedTicketOfficeCounter N N See § 11.2.3 Has the booking office got a low-level/split
level counter?
RampForTrainAccess N N See § 11.2.3 Is there a ramp for train access available at
the station?
AccessibleTaxis N N See § 11.2.3 Are accessible taxis available?
AccessiblePublicTelephones N N See § 11.2.3 Are there low-level/text phones available?
NearestStationsWithMoreFacilities N N See § 11.2.20 List of recommended nearby stations with
more impaired access facilities. Specified
by CRS code.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 26 of 48
NationalKeyToilets N N See § 11.2.3 Is there an Impaired Access toilet run as
part of the National Key Scheme at the
station?
StepFreeAccess N N See § 7.2.3.16 Information on step free access to the
station.
TicketGates N N See § 11.2.3 Are ticket gates available at the station?
ImpairedMobilitySetDown N N See § 11.2.3 Is there an Impaired Mobility set down point
at or near to the entrance to the station?
WheelchairsAvailable N N See § 11.2.3 Are there wheelchairs available at the
station?
7.2.3.16 Step Free Access Structure
Field Mand Mult Type/Values Description
Annotation N N See § 0 Step free access notes
Coverage N N wholeStation,
Indicates how much of the station is accessible. Further
partialStation,
details should be given in the annotation.
allPlatforms,
noPartOfStation,
unknown
7.2.3.17 Interchange Structure
Field Mand Mult Type/Values Description
CycleStorage Y N See § 7.2.3.18 Availability of Cycle Storage facilities.
CarPark N Y See § 7.2.3.19 Car park availability and information.
RailReplacementServices N N See § 0 Information on Rail Replacement Services.
TaxiRank N N See § 0 Is there a taxi rank at the station?
OnwardTravel N N See § 0 The onward travel available from this station.
MetroServices N N See § 0 The metro services available from this station.
Airport N N See § 0 Does the Station give access to an Airport?
Port N N See § 0 Does the Station give access to a Port or ferry
service?
CarHire N N See § 0 Can cars be hired at or near the station?
CycleHire N N See § 0 Can cycles be hired at or near the station?
7.2.3.18 Cycle Storage Structure
Field Mand Mult Type/Values Description
Spaces N N Integer Number of spaces available. e.g., 55
Sheltered N N Yes,
Degree of shelter for the Cycle Storage area.
No,
Partial,
Unknown
Cctv N N Boolean If the Cycle Storage area is completely covered by CCTV coverage.
e.g., ‘false’.
Location N N See § 11.2.11 The location in the station of the Cycle Storage.
Annotation N N See § 11.2.11 Any additional information related to Cycle Storage.
Type N Y String Type of Cycle Storage Available. e.g., ‘Lockers’.
7.2.3.19 Car Park Structure
Field Mand Mult Type/Values Description
© Rail Settlement Plan Limited 2025
Name Spaces Charges NumberAccessibleSpaces AccessibleSpacesNote AccessibleCarParkEquipment AccessibleCarParkEquipmentNote Cctv National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 27 of 48
N N String Name of the car park. e.g., ‘Station’.
N N Integer Total number of spaces available. e.g.,
450
N N See § 0 Description of parking charges.
N N Integer Number of accessible spaces available.
e.g., 10
N N String Additional information about accessible
spaces. e.g., ‘Next to rear entrance’.
N N Boolean Does the car park have accessible
equipment available? e.g., ‘true’.
N N String Additional information about accessible
car park equipment.
e.g., ‘This car park is accredited’.
N N Boolean If the car park area is covered by CCTV
coverage. e.g., ‘false’.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 28 of 48
7.2.3.20 Charges Structure
Field Mand Mult Type/Values Description
Off-peak N N String Price at this time/rate, if applicable. e.g., ‘£6.40’
PerHour N N String Price at this time/rate, if applicable. e.g., ‘N/A’
Daily N N String Price at this time/rate, if applicable. e.g., ‘£6.40’
Weekly N N String Price at this time/rate, if applicable. e.g., ‘£6.40’
Monthly N N String Price at this time/rate, if applicable. e.g., ‘£6.40’
ThreeMonthly N N String Price at this time/rate, if applicable. e.g., ‘N/A’
SixMonthly N N String Price at this time/rate, if applicable. e.g., ‘£6.40’
Annual N N String Price at this time/rate, if applicable. e.g., ‘£6.40’
Saturday N N String Price at this time/rate, if applicable. e.g., ‘£6.40’
Sunday N N String Price at this time/rate, if applicable. e.g., ‘£6.40’
Note N N String Car park pricing additional information. e.g., ‘Season permit holder
and disabled parking only at this station, no daily or weekly
parking is available’.
OR
Field Mand Mult Type/Values Description
Free Y N Boolean Is it free to park at this station? e.g., ‘true’.
Note N N String Car park pricing additional information.
e.g., ‘Season permit holder and disabled parking only at this
station, no daily or weekly parking is available’.
7.2.3.21 Rail Replacement Structure
Field Mand Mult Type/Values Description
Annotation N N See § 0 General information about rail replacement services.
e.g., ‘Rail replacement buses stop in the main station
car park’.
RailReplacementMap N Y URI URI to a map showing the station in the local area.
7.2.3.22 Station Alert Structure
Field Mand Mult Type/Values Description
AlertText N N String Alert information for the station. Generally, contains information on
events having a long-term impact at the station. e.g., ‘National Rail
services no longer run between Moorgate and Farringdon…’ or ‘Lifts
for Platforms 2 & 3 are currently being refurbished and will be out of
public use until April 2017’ etc.
7.2.3.23 Train Operating Companies Structure
Field Mand Mult Type/Values Description
TocRef Y Y String (2) Two-character TOC code. e.g., ‘LE’.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 29 of 48
8. ‘Promotions’ schema
8.1 Overview
8.1.1 This section defines the structure and provides a high-level description of the Promotions XML
tags.
8.1.2 Where a tag is marked mandatory, consumers can rely upon the presence of this tag. Tags
not marked mandatory are optional, i.e., consumers should not rely on these elements
existing. Child tags marked as mandatory are only mandatory if their parent tag exists.
8.1.3 Where a tag is marked multiple, this means that this tag can be repeated, tags not marked as
multiple will not be repeated.
8.2 Version 4.0
8.2.1 NRE website
8.2.1.1 The NRE website displays this data at the following URL:
https://www.nationalrail.co.uk/ticket-types/promotions/?promotion
8.2.2 XSD
8.2.2.1 nre-promotion-v4-0.xsd
8.2.3 Elements
8.2.3.1 Root
Field Mandatory Multiple Type/Values Description
PromotionList Y N See § 8.2.3.2 Root element for Promotions feed which will
contain one or more child elements.
8.2.3.2 Promotions
Field Mand Mult Type/Values Description
Promotion N Y See § 8.2.3.3 Container for Promotion information.
8.2.3.3 Promotion Structure
Field Mand Mult Type/Values Description
ChangeHistory Y N See § 11.2.1 Who changed the data most recently?
PromotionIdentifier Y N String (32) Unique Identifier of the promotion within
the knowledge base.
e.g.,
‘prd359000a04000200b5da61f1e92b72’
Type Y N String Types of promotions.
e.g., ‘RangerRover’.
NearestStation N N See § 8.2.3.13 List of stations promotion is applicable to.
InterchangeStations N N String Interchange stations – not used.
PromotionName Y N String The name of the Promotion.
e.g., ‘16-25 Railcard’.
Summary Y N String Summary details of the Promotion.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
Field Mand Mult Type/Values OfferDetails N N See § 8.2.3.6 ValidityPeriod N N See § 11.2.16 ValidityDayAndTime N N See § 11.2.6 AvailableFromDate N N See § 11.2.16 Region N Y ‘BM’
,
‘BS’
,
‘CB’
,
‘GB’
,
‘HL’
,
‘LDN’
,
‘LS’
,
‘MR’
,
‘NC’
,
‘NO’
,
‘NT’
,
‘OX’
,
‘PY’
,
‘SCOTLAND’
,
‘SO’
,
‘TW’
,
‘WALES’
.
AreaMap N N See § 8.2.3.6 TimetableLinks N N See § 8.2.3.7 LeadToc N N String (2) ApplicableTocs Y N See § 8.2.3.12 Operators N N String ExcludedServices N N String ProductPrices N N See § 8.2.3.14 ApplicableOriginStationGroups N N See § 11.2.22 ApplicableOrigins N N See § 11.2.23 ApplicableDestinationStationGroups N N See § 11.2.22 ApplicableDestinations N N See § 11.2.23 ApplicableZoneOfStationGroups N N See § 11.2.22 ApplicableZoneOfStations N N See § 11.2.23 Reversible Y N Boolean PromotionFlows N N See § 0 FurtherInformation N N See § 8.2.3.6 TicketValidityConditions N N See § 8.2.3.6 BookingConditions N N See § 8.2.3.6 PurchaseDetails N N See § 8.2.3.6 Passengers N N See § 8.2.3.16 PromotionRailCards N N See § 8.2.3.4 PromotionCode N N String (3,4) NlcCode N N String TocContact N N See § 11.2.9 RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 30 of 48
Description
e.g., ‘Aged 16-25 or a full-time student
aged 26 or over? Save 1/3 off…’ etc.
Details of the Promotion. Who is eligible
and other further conditions.
Period during which tickets bought under
the promotion may be used.
Period during which the promotion is valid
in terms of days and time.
Date from which the promotion is available
for purchase by public. May be earlier than
the validity period.
Region within which the promotion applies
– Not Used.
Link to a map showing where the
promotion applies.
Not Used.
Two-character TOC code of the lead toc
who created the promotion.
List of TOCs for which promotion is
applicable.
Not used.
Not used.
Cost of Promotion, if applicable.
List of station groups for the origin(s).
List of station CRS codes at which journey
must start.
List of station groups for the destination(s).
List of station CRS codes at which journey
must end.
List of station groups for the zones.
Zone containing station CRS codes at
which offer applies for use of promotion.
Is promotion valid travelling in both
directions? e.g., ‘true’.
What are the flows and exceptions for this
promotion?
Further information about the Promotion.
Description of the Ticket Validity Conditions
for the Promotion.
Booking conditions that apply to the
promotion.
How and where to purchase the promotion.
Number of Passengers.
Which Railcards are applicable to this
promotion?
Three or four-character code identifying a
Promotion. E.g., ‘BV1’ for the ‘Bittern Line
Ranger’.
If applicable, NLC code of Promotion.
Information about contact at TOC.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 31 of 48
Field Mand Mult Type/Values Description
InternalInfo N N See § 8.2.3.17 Internal information about the promotion
(not visible to public).
TicketName N N String Name of ticket. e.g., ‘DAY RANGER’.
AdultFares N N See § 0 Adult fares available under the promotion.
ChildFares N N See § 0 Child fares available under the promotion.
FamilyFares N N See § 0 Family fares available under the promotion.
ConcessionFares N N See § 0 Concession fares available under the
promotion.
GroupFares N N See § 0 Group fares available under the promotion.
DayTicket N N See § 8.2.3.19 Not Used.
SeasonTicket N N See § 8.2.3.20 Not Used.
ViewableBy Y N ‘Public’
,
Who can view the promotion?
‘Internal’
’xmlFeed’.
,
DiscountsAvailable N N See § 8.2.3.21 Any other discounts available for this
Promotion?
8.2.3.4 Promotion Railcard List Structure
Field Mand Mult Type/Values Description
PromotionRailCard Y Y See § 8.2.3.5 A structure containing a list of railcards.
8.2.3.5 Promotion Railcard Structure
Field Mand Mult Type/Values Description
RailCardId Y N String Name of Railcard. e.g., ‘Annual Gold Card’.
Price N N String Price with Railcard. e.g., 24.40.
Details N N String Any Additional details about the discount available for this promotion
with this railcard. e.g., ‘Can only be used on…’ etc.
8.2.3.6 Link and Details Structure
Field Mand Mult Type/Values Description
Uri N Y URI Hyperlink to the referenced material.
e.g.
https://www.scotrail.co.uk/sites/default/files/assets/
download_ct/central_rover_map.pdf
Details N N String Qualifying detail about referenced material.
e.g. ‘View area of validity map for this product’.
8.2.3.7 Link Structure
Field Mand Mult Type/Values Description
Uri Y Y URI Hyperlink to the referenced material.
e.g.
https://www.scotrail.co.uk/sites/default/files/assets/
download_ct/central_rover_map.pdf
8.2.3.8 Promotion Flows Structure
Field Mand Mult Type/Values Description
Exceptions N N See § 8.2.3.9 Flow exceptions applicable to this Promotion.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 32 of 48
Flows N N See § 8.2.3.10 Flows applicable to this Promotion.
ExceptionsAndFlows N N String Flows and Flow Exceptions applicable to this
Promotion.
8.2.3.9 Exceptions Structure
Field Mand Mult Type/Values Description
Exception Y Y See § 8.2.3.11 Exception container.
8.2.3.10 Flows Structure
Field Mand Mult Type/Values Description
Flow Y Y See § 8.2.3.11 Flow container.
8.2.3.11 Flow Structure
Field Mand Mult Type/Values Description
Origin Y N String (3) CRS code of Origin.
Destination Y N String (3) CRS code of Destination.
Reversible Y N Boolean Is the flow reversible? e.g., ‘true’.
Station N N String (3) CRS code of applicable station.
Tocs N N See § 11.2.21 List of TOCs.
8.2.3.12 Promo Applicable TOCs Structure
Field Mand Mult Type/Values Description
AllTocs Y N Boolean Promotion applicable to All TOCs. e.g., ‘true’.
OR
Field Mandatory Multiple Type/Values Description
TocRef Y Y String (2) List of TOCs, as two-character codes, applicable
to Promotion.
8.2.3.13 Nearest Station Structure
Field Mand Mult Type/Values Description
CrsCode Y Y String (3) List of nearest stations identified by CRS code.
8.2.3.14 Product Prices Structure
Field Mandatory Multiple Type/Values Description
ProductType Y Y See § 8.2.3.15 List of Product prices.
8.2.3.15 Product Type Structure
Field Mand Mult Type/Values Description
Name N N String Name of Product.
Valid N N String Validity of Product.
AdultPrice N N String Adult price of Product.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 33 of 48
ChildPrice N N String Child price of Product.
FamilyPrice N N String Family price of Product.
GroupPrice N N String Group Price of Product.
StaffDiscountAdult N N String Adult Staff discount.
StaffDiscountChild N N String Child Staff discount.
StaffDiscountFamily N N String Staff family discount.
StaffDiscountGroup N N String Staff group discount.
PromotionRailCards N N See § 8.2.3.4 List of railcards applicable to Promotion.
8.2.3.16 Passenger Structure
Field Mand Mult Type/Values Description
Note N N String Free text notes regarding passengers.
e.g., ‘Only valid with specified number of passengers’.
MinAdults N N Integer Minimum number of adults. e.g., 1
MaxAdults N N Integer Maximum number of adults. e.g., 1
MinChildren N N Integer Minimum number of children. e.g.,
MaxChildren N N Integer Maximum number of children. e.g., 2
8.2.3.17 Internal Info Structure
Field Mand Mult Type/Values Description
IssuingInstructions N N String Issuing instructions for Promotion.
e.g., ‘Issued as a Ranger: Ticket type OEO (Oxford Evening
Out) …’ etc.
Details N N String Further details for staff regarding Promotion.
e.g., ‘PRV and PRD Discounts are not available on this
product.’.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 34 of 48
8.2.3.18 Promotion Fare Details Structure
Field Mand Mult Type/Values Description
Price N N String Price information for Promotion. e.g., 30.00.
Details N N String Further details regarding price of Promotion.
e.g. .£30.00 for a 1 year; £70.00 for 3 years’.
8.2.3.19 Day Ticket Structure
Field Mand Mult Type/Values Description
Adult N N Decimal Adult price for day ticket. e.g., 10.20
Child N N Decimal Child price for day ticket. e.g., 5.10
Railcard N N Decimal Railcard discounted price for day ticket. e.g., 7.35
Note N N String Additional information. e.g., ‘day ticket not available for this
Promotion’.
8.2.3.20 Season Ticket Structure
Field Mand Mult Type/Values Description
SevenDays N N Decimal Weekly season ticket price for Promotion. e.g., 25.00
OneMonth N N Decimal Monthly season ticket price for Promotion. e.g., 100.00
ThreeMonths N N Decimal Quarterly season ticket price for Promotion. e.g., 300.00
OneYear N N Decimal Annual season ticket price for Promotion. e.g., 1100.00
Note N N String Additional information. e.g., ‘Season tickets not available for
this Promotion’.
8.2.3.21 Discounts Available Structure
Field Mand Mult Type/Values Description
DiscountDetail N Y See § 8.2.3.22 Detail of available discounts.
PlusBus N N String
SleeperServices N N String
OtherDiscounts N N String
8.2.3.22 Discount Detail
Field Mand Mult Type/Values Description
TicketTypeName N N String
TicketTypeCode N Y String (3) List of three-character ticket type codes.
CardHolder N N String
AccompanyingAdult N N String
AccompanyingChild N N String
Note N N String Additional information.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 35 of 48
9. ‘National Service Indicator’ schema
9.1 Overview
9.1.1 This section defines the structure and provides a high-level description of the National Service
Indicator XML tags.
9.1.2 Where a tag is marked mandatory, consumers can rely upon the presence of this tag. Tags
not marked mandatory are optional, i.e., consumers should not rely on these elements
existing. Child tags marked as mandatory are only mandatory if their parent tag exists.
9.1.3 Where a tag is marked multiple, this means that this tag can be repeated, tags not marked as
multiple will not be repeated.
9.2 Version 4.0
9.2.1 NRE website
9.2.1.1 The NRE website displays this data at the following URL:
https://www.nationalrail.co.uk/status-and-disruptions/?mode=train-operator-status
9.2.2 XSD
9.2.2.1 nre-service-indicator-v4-0.xsd
9.2.3 Elements
9.2.3.1 Root
Field Mandatory Multiple Type/Values Description
NSI Y N See § 9.2.3.2 Root element for National Service Indicator
feed which will contain one or more child
elements.
9.2.3.2 National Service Indicator List Structure
Field Mand Mult Type/Values Description
TOC N Y See § 9.2.3.3 Container for TOC level NSI information.
9.2.3.3 National Service Indicator Structure
Field Mand Mul Type/Values Description
TocCode Y N String (2) Two-character TOC code. e.g., ‘LE’ or ’XC’.
TocName Y N String TOC Brand Name. e.g., ‘Arriva Trains Wales’.
Status Y N String Shows the status of the TOC’s NSI.
e.g., ‘Good service’, ‘Minor delays on all routes’.
StatusImage N N String Status image filename.
e.g., icon-disruption.png
StatusDescription N N String Description of overall status of TOC’s services. e.g.,
‘Good service’, ‘Minor delays on all routes’.
ServiceGroup N Y See § 9.2.3.4 Description of individual incidents affecting a TOC.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 36 of 48
TwitterAccount N N String Twitter account name used by NRE to communicate
updates on disruption for that TOC. e.g.,
‘NRE_ArrivaWales’.
AdditionalInfo N N String Top level additional information regarding the
service status.
e.g., ‘Follow us on Twitter’.
CustomAdditionalInfo N N String More detailed additional information.
9.2.3.4 NSI Service Group Structure
Field Mand Mult Type/Values Description
GroupName N N String The service group descriptive name.
e.g., ‘Cambridge Route’.
CurrentDisruption N N String (32) A unique ID of the service disruption associated to the group.
e.g., ‘174B2A58D5C04FE3B32EF1D64BA45DF1’.
CustomDetail N N String Details of the service group.
e.g., ‘Read about this disruption’.
CustomURL N N URI URL of the service disruption on the NRE desktop website.
e.g.
http://www.nationalrail.co.uk/
service_disruptions/158481.aspx
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 37 of 48
10. ‘Incidents’ schema
10.1 Overview
10.1.1 This section defines the structure and provides a high-level description of the Incidents XML
tags.
10.1.2 Where a tag is marked mandatory, consumers can rely upon the presence of this tag. Tags
not marked mandatory are optional, i.e., consumers should not rely on these elements
existing. Child tags marked as mandatory are only mandatory if their parent tag exists.
10.1.3 Where a tag is marked multiple, this means that this tag can be repeated, tags not marked as
multiple will not be repeated.
10.2 Version 5.0
10.2.1 NRE website
10.2.1.1 The NRE website displays this data at the following URL:
https://www.nationalrail.co.uk/status-and-disruptions/
10.2.2 XSD
10.2.2.1 nre-incident-v5-0.xsd
10.2.3 Elements
10.2.3.1 Root
Field Mandatory Multiple Type/Values Description
Incidents Y N See § 10.2.3.2 Root element for Incidents feed which will contain
one or more child elements.
10.2.3.2 Incidents
Field Mand Mult Type/Values Description
PtIncident N Y See § 10.2.3.3 Container for Incident information.
10.2.3.3 PtIncident Structure
Field Mand Mult Type/Values Description
CreationTime Y N dateTime Time of creation of incident.
e.g., 2016-12-25T15:00:00+00:00
ChangeHistory Y N See § 11.2.1 Who changed the data most recently?
ParticipantRef N N String
IncidentNumber Y N String (32) Unique ID for the incident within KnowledgeBase.
e.g., ‘8B68D83E08C1415A906022178722BDCB’.
Version N N Integer Version of the incident, of the form YYYMMDDHHMMSS.
e.g., 20170225125201
Source N N See § 10.2.3.4 Information about source of information.
OuterValidityPeriod N N See § 11.2.18 Not Used.
ValidityPeriod Y Y See § 11.2.18 Overall inclusive Period of applicability of incident.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 38 of 48
Planned Y N Boolean Set to true if the incident is planned engineering work, false
if an unplanned service disruption.
e.g., ‘true’.
Summary Y N String (>0) A summary of the incident.
e.g., ‘Disruption at Haymarket expected until 14:00’.
Description Y N String (>0) Detailed description of incident.
e.g., ‘The overhead wires at Haymarket have been rectified,
allowing all trains to resume running through the station…’
etc.
InfoLinks N N See § 10.2.3.5 Hyperlink(s) to other resources associated with incident.
Affects N N See § 10.2.3.6 Structured model identifying parts of transport network
affected by incident.
ClearedIncident N N Boolean Set to true if the incident is over. Incidents may be retained
for a period of time after completion to inform users that
incident has cleared.
e.g., ‘true’.
IncidentPriority Y N Integer
P0Summary Y N String
10.2.3.4 Source Structure
Field Mand Mult Type/Values Description
TwitterHashtag N N String Twitter hashtag assigned to an incident.
e.g., ‘#LondonWaterloo’.
10.2.3.5 InfoLink Structure
Field Mand Mult Type/Values Description
Uri Y N URI URI for the hyperlink
e.g.
http://www.nationalrail.co.uk/
static/documents/maps/wat2502.pdf
Label N N String Label for the hyperlink.
e.g., Additional Maps
10.2.3.6 Affects Structure
Field Mand Mult Type/Values Description
Operators N N See § 10.2.3.7 Operators affected by the Incident.
RoutesAffected N N String Free text description of the stations and routes impacted by an
incident.
e.g., ‘ScotRail between Milngavie / Helensburgh Central and
Edinburgh; TransPennine Express between Manchester
Airport and Edinburgh’.
10.2.3.7 Operators Structure
Field Mand Mult Type/Values Description
AffectedOperator Y Y See § 10.2.3.8 Operators of services affected by incident.
10.2.3.8 Affected Operator Structure
Field Mand Mult Type/Values Description
OperatorRef Y N String (2) Two-character TOC code. e.g., ‘AW’.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 39 of 48
OperatorName N N String Operator name. e.g., ‘Arriva Trains Wales’.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 40 of 48
11. Common data
11.1 Overview
11.1.1 The KB XML feeds share several common data elements which, rather than repeat in each
schema, are captured in a ‘Common’ schema described below.
11.2 Version 4.0
11.2.1 XSD
11.2.1.1 nre-common-v4-0.xsd
11.2.2 Change History Structure
Multiple Field Mandatory Type/Values Description
ChangedBy Y N String Describes the last change made to this
document.
ChangedBy -
N N String (2) Two-character TOC code.
@ tocAffiliation
LastChangedDate Y N dateTime Date and time of last alteration.
e.g., 2016-07-12T14:48:00.000+01:00
11.2.3 Available Facility Structure
Field Mand Mult Type/Values Description
Annotation N N See § 0 Annotation container structure.
Open N N See § 11.2.6 Opening hours of this facility.
Location N N See § 11.2.11 Free text information relating to location.
OR
Field Mand Mult Type/Values Description
Annotation N N See § 0 Annotation container structure.
Available N N Boolean A value of true indicates that opening hours are unknown or not
applicable. e.g., ‘true’.
Location N N See § 11.2.11 Free text information relating to location.
11.2.4 Service Structure
Field Mand Mult Type/Values Description
Annotation N N See § 0 Annotation container structure.
ContactDetails N N See § 11.2.9 Contact details for TOC.
Available N N Boolean A value of true indicates that opening hours are unknown or
not applicable, e.g., ‘true’.
OperatorName N N String Name of Operator.
OR
Field Mand Mult Type/Values Description
Annotation N N See § 0 Annotation container structure.
ContactDetails N N See § 11.2.9 Contact details for TOC.
Open N N See § 11.2.6 Opening hours of this service.
OperatorName N N String Name of Operator.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 41 of 48
11.2.5 Travelcards Structure
Field Mand Mult Type/Values Description
TravelcardZone N Y String The London Travelcard zone in which this station lies.
11.2.6 Opening Hours Structure
Field Mand Mult Type/Values Description
Annotation N N See § 0 Annotation container structure.
DayAndTimeAvailability N Y See § 11.2.12 Each DayAndTimeAvailability element provides the
opening hours for a particular range of days.
11.2.7 Telephone Structure
Field Mand Mult Type/Values Description
Exists Y N Boolean Does the station have telephones? e.g., ‘true’
.
UsageType N N Cards,
How is it operated? With coins or cards or both? e.g., ‘Cards’
.
Coins,
CardsAndCoins
11.2.8 Postal Address Structure
Field Mand Mult Type/Values Description
PostalAddress N N See § 12.1.1 Address of the station based on 5-line address and postcode.
11.2.9 Contact Details Structure
Field Mand Mult Type/Values Description
Annotation N N See § 0 Annotation container structure.
PrimaryTelephoneNumber N N See § 11.2.19 Public telephone number for this service.
AlternatePublicTelephoneNumbers N N See § 11.2.19 Alternate telephone numbers available to the
public.
AlternateInternalTelephoneNumbers N N See § 11.2.19 Alternate telephone numbers only available
to staff.
FaxNumber N N See § 11.2.19 A fax number for this service.
PrimaryMinicomNumber N N See § 11.2.19 A minicom number for this service.
AlternateMinicomNumber N N See § 11.2.19 An alternate minicom number for this
service.
PrimaryTextphoneNumber N N See § 11.2.19 A textphone number for this service.
AlternateTextphoneNumber N N See § 11.2.19 An alternative textphone number for this
service.
PostalAddress N N See § 12.1.2 Publicly available postal address of the
service.
EmailAddress N N String (1-255) Publicly available email address for this
service.
AlternativeEmailAddress N N String (1-255) Alternative email address for this service.
Url N N URI Publicly available web site for this service.
e.g. http://nationalrail.co.uk
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 42 of 48
11.2.10 Annotated Structure
Field Mandatory Multiple Type/Values Description
Annotation N N See § 11.2.11 Annotation container structure.
11.2.11 Annotation Content
Field Mandatory Multiple Type/Values Description
Note Y Y String Free text note.
e.g., ‘This is some text’.
11.2.12 Day and Time Availability Structure
Field Mandatory Multiple Type/Values Description
DayTypes Y N See § 11.2.13 Pattern of days.
OpeningHours Y N See § 11.2.14 Hours on the specified day or holiday type
when the facility is available or unavailable.
11.2.13 Days Group
Field Mandatory Multiple Type/Values Description
Monday N N Boolean Available on Monday. e.g., ‘true’.
Tuesday N N Boolean Available on Tuesday. e.g., ‘true’.
Wednesday N N Boolean Available on Wednesday. e.g., ‘true’.
Thursday N N Boolean Available on Thursday. e.g., ‘true’.
Friday N N Boolean Available on Friday. e.g., ‘true’.
Saturday N N Boolean Available on Saturday. e.g., ‘true’.
Sunday N N Boolean Available on Sunday. e.g., ‘true’.
AllBankHolidays N N Boolean Available on all bank holidays, e.g., ‘true’.
OR
Field Mandatory Multiple Type/Values Description
MondayToFriday N N Boolean Available on Monday to Friday. e.g., ‘true’.
AllBankHolidays N N Boolean Available on all bank holidays. e.g., ‘true’.
OR
Field Mandatory Multiple Type/Values Description
MondayToSunday N N Boolean Available on Monday to Sunday. e.g.,
‘true’.
AllBankHolidays N N Boolean Available on all bank holidays. e.g., ‘true’.
OR
Field Mandatory Multiple Type/Values Description
Weekend N N Boolean Available on Saturday and Sunday. e.g.,
‘true’.
AllBankHolidays N N Boolean Available on all bank holidays. e.g., ‘true’.
11.2.14 Daily Opening Hours Structure
Field Mandatory Multiple Type/Values Description
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 43 of 48
TwentyFourHours Y N Boolean Open 24hrs on the specified days (defined as
00:00 until 23:59). e.g., ‘true’.
OR
Field Mandatory Multiple Type/Values Description
OpenPeriod Y Y See § 11.2.15 Each time range indicates an open period.
Multiple ranges can be used to indicate separate
opening hours in the morning and afternoon.
OR
Field Mandatory Multiple Type/Values Description
Unavailable Y N Boolean Not available on this specified day. e.g., ‘true’.
11.2.15 Closed Time Range Structure
Field Mandatory Multiple Type/Values Description
StartTime Y N Time The (inclusive) start time. e.g., 07:00:00
EndTime Y N Time The (inclusive) end time. e.g., 17:00:00
11.2.16 Half Open Date Range Structure
Field Mandatory Multiple Type/Values Description
StartDate Y N Date The (inclusive) start date. e.g., 2017-01-20
EndDate N N Date The (inclusive) end date. If omitted, the range end
is open-ended, that is, it should be interpreted as
‘until further notice’.
11.2.17 Half Open Time Range Structure
Field Mandatory Multiple Type/Values Description
StartTime Y N Time The (inclusive) start time. e.g., 07:00:00
EndTime N N Time The (inclusive) end time. If omitted, the range end
is open-ended, that is, it should be interpreted as
‘until further notice’. e.g., 17:00:00
11.2.18 Half Open Timestamp Range Structure
Field Mandatory Multiple Type/Values Description
StartTime Y N dateTime The (inclusive) start time stamp. e.g., 07:00:00
EndTime N N dateTime The (inclusive) end time stamp. If omitted, the
range end is open-ended, that is, it should be
interpreted as ‘until further notice’. e.g., 17:00:00
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 44 of 48
11.2.19 Telephone Number Structure
Field Mandatory Multiple Type/Values Description
TelNationalNumber Y N String (1-20) Full telephone number including STD prefix.
TelExtensionNumber N N String (1-6) Any additional extension number.
TelCountryCode N N String (1-3) Two-character country prefix, e.g., 44 for UK.
11.2.20 Crs Code List Structure
Field Mandatory Multiple Type/Values Description
Annotation N N See § 0 Annotation container structure.
CrsCode N Y String (3) Three-character CRS code identifying a station.
e.g., ‘KGX’
,
‘GLC’.
11.2.21 Atoc List Structure
Field Mandatory Multiple Type/Values Description
TocRef Y Y String (2) A list of TOC codes. e.g., ‘CS’
,
‘ME’.
11.2.22 Station Group List Structure
Field Mandatory Multiple Type/Values Description
StationGroupRef Y Y String A list of station groups.
e.g., London
11.2.23 Station List Structure
Field Mandatory Multiple Type/Values Description
StationRef Y Y String (3) A list of stations.
e.g., PAD, OXF, RDG
11.2.24 Simple Types
Field Type/Values Description
AtocCodeType String (2) A list of toc codes. e.g., ‘CS’
,
‘ME’.
StartDateType Date Start of miscellaneous period.
e.g., 2017-02-02
EndDateType Date End of miscellaneous period. Default value is '9999-09-
09' representing ‘until further notice’.
e.g., 2017-12-31
CrsCodeType String (3) A list of stations.
e.g., ‘PAD’
,
‘OXF’
,
‘RDG’.
NationalLocationCodeType String (4-7) NLC code for a location. e.g., ‘1444’.
TiplocCodeType String (4-7) Timing Point Location code. e.g., ‘LIVST’.
PopulatedStringType String (>0) A string that requires at least one character of text.
e.g., ‘some text’.
SixteenCharacterNameType String (16) A max 16-character version of a station name.
e.g., ‘ST PANCRAS’.
TicketTypeCodeType String (3) Three-character code identifying a ticket type.
e.g., ‘SOS’
,
‘1AF’.
NlcCodeType String NLC code for a location. e.g., ‘1444’.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 45 of 48
BbcRegionEnumeration ‘BM’
,
‘BS’
,
‘CB’
,
‘GB’
,
‘HL’
,
The list of BBC Region codes.
‘LDN’
‘LS’
’MR’
‘NC’
,
,
,
,
‘NO’
‘NT’
‘OX’
,
,
,
‘PY’
‘SCOTLAND’
,
,
‘SO’
,
‘TW’
,
‘WALES’.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 46 of 48
12. Address Types
12.1 Version 2.0
The following are common elements from AddressTypes-v2-0.xsd.
12.1.1 UK Address Structure
Multiple Field Mandatory Type/Values Description
BS7666Address Y N See § 13.1.1 Address container.
UniquePropertyReferenceNumber N N Integer Unique Property Reference Number.
e.g., 1234
SortCode N N String (5) Mail sort code.
e.g., ‘ght73’.
OR
Field Mandatory Multiple Type/Values Description
BS7666Address Y N See § 13.1.1 Address container.
UniquePropertyReferenceNumber N N Integer Unique Property Reference Number.
e.g., 1234
WalkSort N N String (8) Mail walk sort code.
e.g., ‘hjgu73h6’.
OR
Field Mandatory Multiple Type/Values Description
A_5LineAddress Y N See § 12.1.2 5-line address container.
BS7666Address N N See § 13.1.1 Address container.
UniquePropertyReferenceNumber N N Integer Unique Property Reference Number
e.g., 1234
SortCode N N String (5) Mail sort code. e.g., ‘ght73’.
OR
Field Mandatory Multiple Type/Values Description
A_5LineAddress Y N See § 12.1.2 5-line address container.
BS7666Address N N See § 13.1.1 Address container.
UniquePropertyReferenceNumber N N Integer Unique Property Reference Number
e.g., 1234
WalkCode N N String (8) Mail walk sort code
e.g., ‘hjgu73h6’.
12.1.2 UK Postal Address Structure
Field Mandatory Multiple Type/Values Description
Line Y Y (2-5) String (1-35) Address line. e.g., ‘10 Downing Street’.
PostCode N N String (8) UK postcode. e.g., ‘WC1N 1BY’.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 47 of 48
13. BS7666 Address
13.1 Version 2.0
The following are common elements from bs7666-v2-0.xsd.
13.1.1 BS7666 Address
Field Mandatory Multiple Type/Values Description
BSaddressStructure Y N See § 13.1.2 Address structure container.
13.1.2 BS Address Structure
Field Mandatory Multiple Type/Values Description
SAON N N See § 13.1.3 Secondary Addressable Object.
PAON Y N See § 13.1.3 Primary Addressable Object.
StreetDescription Y N String (1-100) Description of street.
e.g., ‘This is a street’.
UniqueStreetReferenceNumber N N Integer Unique Street Reference Number. e.g.,
45637
Locality N N String (1-35) Locality definition.
Town N N String (1-30) Town definition.
AdministrativeArea N N String (1-30) Admin area definition.
PostTown N N String (1-30) Post down definition.
PostCode N N String (8) UK postcode. e.g., ‘WC1N 1BY’.
UniquePropertyReferenceNumber N N Integer Unique Property Reference Number.
e.g., 1234
13.1.3 AON structure
Field Mandatory Multiple Type/Values Description
StartRange Y N See § 13.1.4 Start range structure.
EndRange N N See § 13.1.4 End range structure.
Description N N String (90) Description. e.g., ‘This is the range’.
OR
Field Mandatory Multiple Type/Values Description
Description N N String (90) Description. e.g., ‘This is the range’.
13.1.4 AON range Structure
Field Mandatory Multiple Type/Values Description
Number Y N Integer Number? e.g., 45
Suffix N N String (1) Suffix? e.g., ‘G’.
© Rail Settlement Plan Limited 2025
National Rail Enquiries
Knowledgebase
Data Feeds Specification
RSPS5050 P-03-00 Rev A
18-Nov-2025
Page 48 of 48
End.
© Rail Settlement Plan Limited 2025