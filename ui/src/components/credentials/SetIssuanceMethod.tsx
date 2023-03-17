import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  InputNumber,
  Radio,
  Row,
  Space,
  Tag,
  TimePicker,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";

import { parseLinkExpirationDate } from "src/adapters/parsers/forms";
import { ReactComponent as IconBack } from "src/assets/icons/arrow-narrow-left.svg";
import { ReactComponent as IconRight } from "src/assets/icons/arrow-narrow-right.svg";
import { ACCESSIBLE_UNTIL, CREDENTIAL_LINK } from "src/utils/constants";

export type IssuanceMethod =
  | {
      type: "directIssue";
    }
  | {
      linkExpirationDate?: dayjs.Dayjs;
      linkExpirationTime?: dayjs.Dayjs;
      linkMaximumIssuance?: string;
      type: "credentialLink";
    };

export function SetIssuanceMethod({
  credentialExpirationDate,
  initialValues,
  isCredentialLoading,
  onStepBack,
  onSubmit,
}: {
  credentialExpirationDate?: dayjs.Dayjs;
  initialValues: IssuanceMethod;
  isCredentialLoading: boolean;
  onStepBack: (values: IssuanceMethod) => void;
  onSubmit: (values: IssuanceMethod) => void;
}) {
  const [issuanceMethod, setIssuanceMethod] = useState<IssuanceMethod>(initialValues);

  const isDirectIssue = issuanceMethod.type === "directIssue";

  return (
    <Card className="issue-credential-card" title="Choose how to issue credential">
      <Form
        initialValues={initialValues}
        layout="vertical"
        name="issueCredentialMethod"
        onFinish={onSubmit}
        onValuesChange={(changedValues, allValues) => {
          const parsedLinkExpirationDate = parseLinkExpirationDate.safeParse(changedValues);

          if (
            allValues.type === "credentialLink" &&
            parsedLinkExpirationDate.success &&
            (parsedLinkExpirationDate.data.linkExpirationDate === null ||
              (dayjs().isSame(parsedLinkExpirationDate.data.linkExpirationDate, "day") &&
                dayjs().isAfter(allValues.linkExpirationTime)))
          ) {
            setIssuanceMethod({ ...allValues, linkExpirationTime: undefined });
          } else {
            setIssuanceMethod(allValues);
          }
        }}
        requiredMark={false}
        validateTrigger="onBlur"
      >
        <Form.Item name="type" rules={[{ message: "Value required", required: true }]}>
          <Radio.Group className="full-width" name="type">
            <Space direction="vertical">
              <Card className={`${isDirectIssue ? "selected" : ""} disabled`}>
                <Radio disabled value="directIssue">
                  <Space direction="vertical">
                    <Typography.Text>
                      Direct issue <Tag>Coming soon</Tag>
                    </Typography.Text>

                    <Typography.Text type="secondary">
                      Issue credentials directly using a known identifier - connections with your
                      organization or establish connection with new identifiers.
                    </Typography.Text>
                  </Space>
                </Radio>
              </Card>

              <Card className={issuanceMethod.type === "credentialLink" ? "selected" : ""}>
                <Space direction="vertical" size="large">
                  <Radio value="credentialLink">
                    <Space direction="vertical">
                      <Typography.Text>{CREDENTIAL_LINK}</Typography.Text>

                      <Typography.Text type="secondary">
                        Anyone can access the credential with this link. You can deactivate it at
                        any time.
                      </Typography.Text>
                    </Space>
                  </Radio>

                  <Space direction="horizontal" size="large" style={{ paddingLeft: 28 }}>
                    <Space align="end" direction="horizontal">
                      <Form.Item help="Optional" label={ACCESSIBLE_UNTIL} name="linkExpirationDate">
                        <DatePicker
                          disabled={isDirectIssue}
                          disabledDate={(current) =>
                            current < dayjs().startOf("day") ||
                            (credentialExpirationDate !== undefined &&
                              current.isAfter(credentialExpirationDate))
                          }
                        />
                      </Form.Item>

                      <Form.Item
                        getValueProps={() => {
                          return {
                            linkExpirationTime:
                              issuanceMethod.type === "credentialLink" &&
                              issuanceMethod.linkExpirationTime,
                          };
                        }}
                        name="linkExpirationTime"
                      >
                        <TimePicker
                          disabled={isDirectIssue}
                          disabledTime={() => {
                            const now = dayjs();

                            if (
                              issuanceMethod.type === "credentialLink" &&
                              now.isSame(issuanceMethod.linkExpirationDate, "day")
                            ) {
                              return {
                                disabledHours: () => [...Array(now.hour()).keys()],
                                disabledMinutes: (hour) => {
                                  return now.hour() === hour
                                    ? [...Array(now.minute() + 1).keys()]
                                    : hour < 0
                                    ? [...Array(60).keys()]
                                    : [];
                                },
                              };
                            } else {
                              return {};
                            }
                          }}
                          format="HH:mm"
                          hideDisabledOptions
                          minuteStep={5}
                          showNow={false}
                          value={
                            issuanceMethod.type === "credentialLink"
                              ? issuanceMethod.linkExpirationTime
                              : undefined
                          }
                        />
                      </Form.Item>
                    </Space>

                    <Form.Item
                      help="Optional"
                      label="Set maximum issuance"
                      name="linkMaximumIssuance"
                    >
                      <InputNumber
                        className="full-width"
                        disabled={isDirectIssue}
                        min={1}
                        placeholder="e.g 1000"
                        size="large"
                        type="number"
                      />
                    </Form.Item>
                  </Space>
                </Space>
              </Card>
            </Space>
          </Radio.Group>
        </Form.Item>

        <Row gutter={8} justify="end">
          <Col>
            <Button
              icon={<IconBack />}
              loading={isCredentialLoading}
              onClick={() => {
                onStepBack(issuanceMethod);
              }}
            >
              Previous step
            </Button>
          </Col>

          <Col>
            <Button htmlType="submit" loading={isCredentialLoading} type="primary">
              Create credential link <IconRight />
            </Button>
          </Col>
        </Row>
      </Form>
    </Card>
  );
}