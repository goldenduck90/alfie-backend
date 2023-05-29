## Sandbox Values

```
Field Name	Values
controlNumber	"000000001", "000000002", "000000003", "000000004", "123456789"
memberId	"0000000000", "0000000001", "0000000002", "1234567890", "0000000004", "0000000005", "0000000006","0000000007", "123456789"
firstName	"johnone", "johntwo", "janeone", "janetwo"
lastName	"doeone", "doetwo"
middleName	"middleone", "middletwo"
gender	"m", "f"
dateOfBirth	"18800102", "18800101", "18160421", "19800101", "19800102", "20000101", "20000102"
ssn	"000000000", "555443333", "111111111", "000000001", "891234567", "123456789"
groupNumber	"0000000000", "1111111111", "1234567891", "0000000001", "0000000002", "0000000003", "0000000004", "0000000005"
address1	"123 address1", "000 address1"
address2	"apt 123", "apt 000", "123", "000"
city	"city1", "city2"
state	"wa", "tn"
postalCode	"981010000", "372030000"
employerId	"00000", "12345", "00001", "00002", "000000000", "123456789", "123456"
propertyCasualtyClaimNumber	"00000", "12345", "00001", "00002"
patientControlNumber	"00000", "12345", "00001", "00002"
priorAuthorizationNumber	"00000", "12345", "00001", "00002"
referralNumber	"00000", "12345", "00001", "00002"
repricedClaimNumber	"00000", "12345", "00001", "00002"
investigationalDeviceExemptionNumber	"00000", "12345", "00001", "00002"
claimNumber	"00000", "12345", "00001", "00002"
name	"johnone doeone", "johntwo doetwo", "janeone doeone", "janetwo doetwo", "submitter contact info"
phoneNumber	"0000000000", "123456789", "0000000001", "0000000002"
faxNumber	"0000000000", "123456789", "0000000001", "0000000002"
email	"email@email.com", "email@email.net"
stateLicenseNumber	"0000000", "0000001", "123456"
contractVersionIdentifier	"111111", "222222", "123456"
priorAuthorizationNumber	"00000", "12345", "00001", "00002"
referralNumber	"00000", "12345", "00001", "00002"
claimControlNumber	"00000", "12345", "00001", "00002"
cliaNumber	"12D4567890", "00D0000001"
mammographyCertificationNumber	"00000", "12345", "00001", "00002"
medicalRecordNumber	"00000", "12345", "00001", "00002"
demoProjectIdentifier	"00000", "12345", "00001", "00002"
carePlanOversightNumber	"00000", "12345", "00001", "00002"
policyNumber	"00000", "12345", "00001", "00002"
npi	"1760854442", "1942788757", "0123456789"
organizationName	"happy doctors group", "happy doctors grouppractice","extra healthy insurance", "regional ppo network"
```

## tradingPartnerServiceId (from CCID)

```
tradingPartnerServiceId	Description
00001	This is a canned response that returns a single coverage plan. This will work for any payer.
000002	This is a canned response that returns a badly formatted 271. This will work for any payer.
00003	This is a canned response that returns a good 271 that contains maxed MSG01 field (AN..264) and EB03 repeating data element (99 repeats). This will work for any payer.
00004	This is a canned response that returns AAA Not Eligible For Inquiries. This will work for any payer.
00005	This is a canned response that contains non-printable characters which we need to make sure we can parse. This will work for any payer.
00006	A system error from the Payer.  AAA segment in the 2000A Information Source Loop with AAA01 = Y, AAA03 = 42 and AAA04 = R.
00007	This is a canned response that returns a single coverage plan with unused fields. This will work for any payer.
000008	This is a canned response that returns a 271 that contains data in deprecated fields. It is used to test our parser's handling of data in these fields. This will work for any payer.
00009	This returns a canned 271 response where the patient is a dependent.
000010	Hospital Inquiry: A 270 request with provider ID, subscriber ID, DOB, First Name, Date of Service and service type as input parameters.
000011	Rehabilitation Inquiry:  A 270 request with provider ID, subscriber ID, DOB, First Name, Last Name Date of Service and service type as input parameters.
000012	Medical Care Inquiry: A 270 request with provider ID, subscriber ID, Date of Service and service type as input parameters.
000013	Rehabilitation Inquiry: A 270 request with provider ID, Subscriber last name, first name, Date of Service and service type as input parameters.
Sample response from Health Maintenance Organization (HMO) Blue.
000014	Vision (Optometry) Inquiry: A 270 request with provider ID, subscriber ID, SSN, DOB, Date of Service and service type as input parameters.
000015	Home Health Care Inquiry:  A 270 request with provider ID, subscriber ID, DOB, Date of Service and service type as input parameters.
000016	Pharmacy Inquiry: A 270 request with provider ID, subscriber ID, DOB, First Name, Last Name, Date of Service and service type as input parameters.
000017	Medical Care Inquiry: A 270 request with provider ID, subscriber ID, Date of Service and service type as input parameters.
000018	Emergency Services Inquiry: A 270 request with Information Receiver, Subscriber ID, Subscriber Last Name, Date of Service and Service Type parameters as follows is given as input.
000019	Rehabilitation Inquiry: A 270 request with provider ID, subscriber SSN, DOB, Date of Service and service type as input parameters.
000020	Rehabilitation Inquiry: A 270 request with provider ID, subscriber ID, DOB, First Name, Date of Service and service type as input parameters.
000021	Rehabilitation Inquiry: A 270 request with provider ID, DOB, First Name, Last Name Date of Service and service type as input parameters.
000022	Medical Care Inquiry: A 270 request with provider ID, subscriber ID, Date of Service and service type as input parameters.
000023	Health Benefit Plan Coverage Inquiry: A 270 request with provider ID, subscriber ID, Last Name, First Name, Date of Service and service type as input parameters.
Sample response from Medicare Part A/Medicare Part B.
000024	Health Benefit Plan Coverage Inquiry:  A 270 request with provider ID, subscriber ID, First Name, Date of Service and service type as input parameters.
000025	Rehabilitation Inquiry: A 270 request with provider ID, subscriber ID, Last Name, Date of Service and service type as input parameters.
000026	Hospital Inquiry: A 270 request with provider ID, subscriber ID, DOB, First Name, service type and diagnosis code as input parameters.
000027	Hospital Inquiry: A 270 request with provider ID, subscriber ID, DOB, First Name, service type and provider code as input parameters.
000028	Hospital Inquiry: A 270 request with provider ID, subscriber ID, DOB, First Name, service type and provider information as input parameters.
000029	Health Benefit Plan Coverage Inquiry: A 270 request with Invalid Provider ID.
000030	Health Benefit Plan Coverage Inquiry: A 270 request with Invalid Patient Information.
000031	Health Benefit Plan Coverage Inquiry: A 270 request with Inactive Coverage date as service date.
000032	Health Benefit Plan Coverage Inquiry: A 270 request with Duplicate. Subscriber ID.
000033	Health Benefit Plan Coverage Inquiry: A 270 request with Invalid Provider ID.
000034	Rehabilitation Inquiry: A 270 request with Subscriber ID, Dependent first Name and service type code as input parameters.
000035	Pharmacy Inquiry: A 270 request with Subscriber ID, Dependent first Name and service type as input parameters.
00036	Florida Medicaid: Sample response.
000036	Home Health Care Inquiry: A 270 request with Subscriber ID, Dependent DOB and service type as input parameters.
000037	Psychiatric Inquiry: A 270 request with Subscriber ID, Dependent First Name and service type as input parameters.
000038	Rehabilitation Inquiry: A 270 request with Subscriber ID, Dependent DOB, Dependent Last Name and service type as input parameters.
000039	Different Deductible at 30 and other STC.
000040	EB 1 with no benefits (Active Coverage) and EB I (Non Covered).
000041	Test EB 6 (Inactive) and EB W (Other Source of Data).
000042	EB R — other additional payer.
Sample use case for standard Medicaid benefit.
000043	EB W response (Other source of Data).
000044	High Out of pocket remaining but no deductible in response.
000045	Low Deductible High Premium — many different copayments.
000046	Low Deductible High Premium with no coinsurance.
000047	Low Deductible High Premium.
000048	Low Deductible with no copayment.
000049	Multiple Services.
000050	No Deductible, High Out of Pocket Remaining, only Copay and coinsurance.
000051	No Deductible, only copay for 33,98, UC.
000052	No Deductible, No copayment.
000053	Plan with active coverage but no patient responsibility.
000054	Response with AD time period 25.
000055	Too many deductibles at service levels.
000056	Uniquely formatted EB segment.
000067	Sample use case from PAA.
000068	Sample use case 2 from PAA.
000069	Sample Use case for EB V (Cannot Process).
000070	Sample Use case for EB U (Contact Following Entity for Eligibility or Benefit Information).
000074	Sample Use case for Connecticut Medicaid.
000081	Sample response for WellCare.
000082	Sample response for Blue Cross Blue Shield Georgia.
000083	Sample response for Humana.
ABHFL	Sample use case for Aetna Better Health of Florida.
ABHKY	Sample use case for Aetna Better Health of Kentucky.
ABHLA	Sample use case for Aetna Better Health of Louisiana.
ABHMO	Sample use case for Aetna Better Health of Missouri.
AETNX	Sample response for AETNA.
BCCTC	Sample use case for Blue Cross Blue Shield Connecticut.
BCNJC	Sample response for BCBS of New Jersey (Horizon).
CABC	A 270 request with memberId, firstName, lastName,gender,entityIdentifier,entityType,dateOfBirth,groupNumber,relationToSubscriber,
insuredIndicator,maintenanceTypeCode, and
maintenanceReasonCode.
Sample response for Platinum Full PPO 250 15 OFFEX.
CIGNA	A sample response for CIGNA for dependent.
CMSMED	A 270 request with additional fields.
Sample response for Medicare Part A/Medicare Part B.
CNTCR	Sample use case for Connecticare Inc.
COVON	Sample response for Coventry.
CT	Sample use case for Connecticut Medicaid.
DENTAL	Sample response for benefits from Dental Payer.
HUM	Sample response for Humana.
ILMSA	Sample use case for Aetna Better Health of Illinois.
ISCAM	Sample response for Medi-CAL Portal connection.
MA/MB	Sample response for Medicare Part A/Medicare Part B.
MEDX	Sample response for MEDEX.
MMSI	Sample use case for Mayo.
TRICE	Sample response for Tricare.
TX	Sample response for Texas Medicaid.
TXBCBS	Sample response for Blue Advantage HMO.
UHC	Sample response for United Healthcare.
```
