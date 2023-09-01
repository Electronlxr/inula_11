/*
 * Copyright (c) Huawei Technologies Co., Ltd. 2023-2023. All rights reserved.
 */
import Horizon from "@cloudsop/horizon";
import { FormattedMessage } from "../../index";

const Example2= () => {

  return (
    <div className="card">
      <h2>FormattedMessage方式测试Demo</h2>
      <pre>
          <FormattedMessage id='text2'/>
      </pre>
    </div>
  );
};

export default Example2;
